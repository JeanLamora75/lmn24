import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium, type Browser } from "playwright";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceCaptureService } from "./source-capture.service";
import { SourceMediaService } from "./source-media.service";
import { inspectSocialPage } from "./source-social-page";

vi.mock("playwright", () => ({ chromium: { launch: vi.fn() } }));
vi.mock("./source-social-page", () => ({ inspectSocialPage: vi.fn() }));

const site = "https://8.8.8.8/";

describe("SCRUM-30 — recherche authentifiée, bornée et protégée côté navigateur", () => {
  const page = {
    goto: vi.fn(async () => ({ status: () => 200 })),
    evaluate: vi.fn(async () => ({ title: "Journal", body: "Actualités locales" })),
    url: vi.fn(() => site),
    setDefaultTimeout: vi.fn(),
    waitForTimeout: vi.fn(async () => undefined),
  };
  const context = {
    route: vi.fn(async () => undefined),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  function service(): SourceCaptureService {
    return new SourceCaptureService(
      {} as SourceMediaService,
      { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    page.url.mockReturnValue(site);
    vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Browser);
    vi.mocked(inspectSocialPage).mockResolvedValue({
      candidates: [
        { url: "https://facebook.com/journal", origin: "footer" },
        { url: "https://twitter.com/journal", origin: "sameAs" },
        { url: "https://x.com/intent/tweet?url=http://test", origin: "body" },
      ],
      internalPages: [],
    });
  });

  it("retourne les comptes déclarés sans télécharger les pages sociales ni rien persister", async () => {
    const result = await service().discoverSocialLinks(site);
    expect(result).toEqual({
      facebookUrl: "https://facebook.com/journal",
      xUrl: "https://twitter.com/journal",
      instagramUrl: null,
      youtubeUrl: null,
    });
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(page.goto).toHaveBeenCalledWith(site, {
      waitUntil: "domcontentloaded", timeout: 15_000,
    });
    expect(context.route).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("visite au maximum deux pages internes du même site", async () => {
    vi.mocked(inspectSocialPage)
      .mockResolvedValueOnce({
        candidates: [], internalPages: [
          "https://8.8.8.8/contact", "https://8.8.8.8/about",
          "https://8.8.8.8/legal",
          "https://not-the-source.example/contact",
        ],
      })
      .mockResolvedValue({
        candidates: [{ url: "https://youtube.com/@journal", origin: "footer" }],
        internalPages: [],
      });
    const result = await service().discoverSocialLinks(site);
    expect(result.youtubeUrl).toBe("https://youtube.com/@journal");
    expect(page.goto).toHaveBeenCalledTimes(3);
  });

  it("bloque les URL privées et les redirections vers un réseau local", async () => {
    await expect(service().discoverSocialLinks("http://127.0.0.1/admin"))
      .rejects.toThrow(BadRequestException);
    expect(chromium.launch).not.toHaveBeenCalled();

    page.url.mockReturnValue("http://127.0.0.1/private");
    await expect(service().discoverSocialLinks(site)).rejects.toThrow(BadRequestException);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("intercepte aussi les ressources et bloque les requêtes internes", async () => {
    await service().discoverSocialLinks(site);
    const callback = (context.route.mock.calls[0] as unknown[] | undefined)?.[1] as
      ((route: { request: () => { url: () => string; resourceType: () => string }; abort: (reason: string) => Promise<void>; continue: () => Promise<void> }) => Promise<void>) | undefined;
    expect(callback).toBeDefined();
    const abort = vi.fn(async () => undefined);
    const cont = vi.fn(async () => undefined);
    await callback!({
      request: () => ({ url: () => "http://localhost/private", resourceType: () => "document" }),
      abort, continue: cont,
    });
    expect(abort).toHaveBeenCalledWith("blockedbyclient");
    expect(cont).not.toHaveBeenCalled();
  });

  it("signale une indisponibilité sans modifier le contenu du formulaire", async () => {
    page.goto.mockRejectedValueOnce(new Error("navigation timeout"));
    await expect(service().discoverSocialLinks(site)).rejects.toThrow(BadRequestException);
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
