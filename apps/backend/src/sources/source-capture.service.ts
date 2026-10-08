import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  chromium,
  type Browser,
} from "playwright";

import { SourceMediaService } from "./source-media.service";

@Injectable()
export class SourceCaptureService {
  private readonly chromiumExecutablePath?: string | undefined;

  constructor(
    private readonly media: SourceMediaService,
    configService: ConfigService,
  ) {
    this.chromiumExecutablePath =
      configService
        .get<string>("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
        ?.trim() || undefined;
  }

  async capture(rawUrl: string): Promise<string> {
    const url = await this.assertPublicHttpUrl(rawUrl);
    const browser = await this.launchBrowser();

    try {
      const context = await browser.newContext({
        viewport: {
          width: 1365,
          height: 768,
        },
      });

      const safetyCache = new Map<string, boolean>();

      await context.route("**/*", async (route) => {
        const requestUrl = route.request().url();

        if (
          requestUrl.startsWith("data:") ||
          requestUrl.startsWith("blob:") ||
          requestUrl.startsWith("about:")
        ) {
          await route.continue();
          return;
        }

        try {
          await this.assertPublicHttpUrl(requestUrl, safetyCache);
          await route.continue();
        } catch {
          await route.abort("blockedbyclient");
        }
      });

      const page = await context.newPage();

      await page.goto(url.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 5_000 })
        .catch(() => undefined);

      const buffer = await page.screenshot({
        type: "png",
        fullPage: false,
      });

      await context.close();

      return this.media.storeImage(buffer, "image/png");
    } catch {
      throw new BadRequestException(
        "La page du site n’a pas pu être capturée.",
      );
    } finally {
      await browser.close();
    }
  }

  private async launchBrowser(): Promise<Browser> {
    const baseOptions = {
      headless: true,
      ...(this.chromiumExecutablePath
        ? { executablePath: this.chromiumExecutablePath }
        : {}),
    };

    try {
      return await chromium.launch(baseOptions);
    } catch (firstError) {
      if (this.chromiumExecutablePath) {
        throw new ServiceUnavailableException(
          "Le navigateur de capture n’est pas disponible.",
        );
      }

      try {
        return await chromium.launch({
          headless: true,
          channel: "chrome",
        });
      } catch {
        throw new ServiceUnavailableException(
          "Le navigateur de capture n’est pas disponible.",
          {
            cause: firstError,
          },
        );
      }
    }
  }

  private async assertPublicHttpUrl(
    rawUrl: string,
    cache?: Map<string, boolean>,
  ): Promise<URL> {
    let url: URL;

    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException("URL du site invalide.");
    }

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      throw new BadRequestException("URL du site invalide.");
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    ) {
      throw new BadRequestException("URL de capture non autorisée.");
    }

    if (cache?.get(hostname) === true) {
      return url;
    }

    if (isIP(hostname)) {
      if (this.isPrivateAddress(hostname)) {
        throw new BadRequestException("URL de capture non autorisée.");
      }

      cache?.set(hostname, true);
      return url;
    }

    let addresses: Array<{ address: string }>;

    try {
      addresses = await lookup(hostname, {
        all: true,
        verbatim: true,
      });
    } catch {
      throw new BadRequestException(
        "Le nom de domaine du site est introuvable.",
      );
    }

    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => this.isPrivateAddress(address))
    ) {
      throw new BadRequestException("URL de capture non autorisée.");
    }

    cache?.set(hostname, true);
    return url;
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase();

    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff")
    ) {
      return true;
    }

    if (normalized.startsWith("::ffff:")) {
      return this.isPrivateAddress(normalized.slice(7));
    }

    if (isIP(normalized) === 4) {
      const octets = normalized.split(".").map(Number);
      const a = octets[0] ?? 0;
      const b = octets[1] ?? 0;

      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
      );
    }

    return false;
  }
}
