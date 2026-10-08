import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { extname, resolve } from "node:path";

const MEDIA_PREFIX = "/source-media/";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

@Injectable()
export class SourceMediaService {
  private readonly mediaDir: string;

  constructor(configService: ConfigService) {
    const configuredDir = configService
      .get<string>("SOURCE_MEDIA_DIR")
      ?.trim();

    this.mediaDir = configuredDir
      ? resolve(configuredDir)
      : resolve(process.cwd(), "uploads", "sources");
  }

  async storeImage(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = MIME_TO_EXTENSION[mimeType];

    if (!extension) {
      throw new BadRequestException(
        "Format d’image non pris en charge. Utilisez PNG, JPEG ou WebP.",
      );
    }

    await mkdir(this.mediaDir, { recursive: true });

    const filename = randomUUID() + extension;
    await writeFile(resolve(this.mediaDir, filename), buffer);

    return MEDIA_PREFIX + filename;
  }

  async readImage(filename: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    if (!this.isSafeFilename(filename)) {
      throw new NotFoundException("Image introuvable.");
    }

    const extension = extname(filename).toLowerCase();
    const contentType = EXTENSION_TO_MIME[extension];

    if (!contentType) {
      throw new NotFoundException("Image introuvable.");
    }

    try {
      return {
        buffer: await readFile(resolve(this.mediaDir, filename)),
        contentType,
      };
    } catch {
      throw new NotFoundException("Image introuvable.");
    }
  }

  async deleteLocalImage(logoUrl: string | null | undefined): Promise<void> {
    const filename = this.filenameFromLogoUrl(logoUrl);

    if (!filename) {
      return;
    }

    try {
      await unlink(resolve(this.mediaDir, filename));
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";

      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  isManagedLogoUrl(value: string): boolean {
    return this.filenameFromLogoUrl(value) !== null;
  }

  private filenameFromLogoUrl(
    logoUrl: string | null | undefined,
  ): string | null {
    if (!logoUrl?.startsWith(MEDIA_PREFIX)) {
      return null;
    }

    const filename = logoUrl.slice(MEDIA_PREFIX.length);

    return this.isSafeFilename(filename) ? filename : null;
  }

  private isSafeFilename(filename: string): boolean {
    return /^[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp)$/i.test(filename);
  }
}
