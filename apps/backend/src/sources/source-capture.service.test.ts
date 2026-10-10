import { ConfigService } from "@nestjs/config";
import { chromium, type Browser } from "playwright";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepareCookieFreeCapture } from "./source-capture-consent";
import { SourceCaptureService } from "./source-capture.service";
import { SourceMediaService } from "./source-media.service";

vi.mock("playwright", () => ({
  chromium: { launch: vi.fn() },
}));
vi.mock("./source-capture-consent", () => ({
  prepareCookieFreeCapture: vi.fn(),
}));

describe("SCRUM-16 — ordre de la capture après consentement", () => {
  const steps: string[] = [];
  const page = {
    goto: vi.fn(async () => { steps.push("navigation"); }),
    waitForLoadState: vi.fn(async () => { steps.push("page stable"); }),
    waitForTimeout: vi.fn(async () => { steps.push("post-consent"); }),
    screenshot: vi.fn(async () => {
      steps.push("screenshot");
      return Buffer.from("png-test");
    }),
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
  const media = {
    storeImage: vi.fn(async () => {
      steps.push("store");
      return "/source-media/test.png";
    }),
  };

  beforeEach(() => {
    steps.length = 0;
    vi.clearAllMocks();
    vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Browser);
    vi.mocked(prepareCookieFreeCapture).mockImplementation(async () => {
      steps.push("consent");
    });
  });

  it("traite le consentement avant screenshot puis sauvegarde l'image", async () => {
    const config = { get: vi.fn().mockReturnValue(undefined) };
    const capture = new SourceCaptureService(
      media as unknown as SourceMediaService,
      config as unknown as ConfigService,
    );

    await expect(capture.capture("https://8.8.8.8/")).resolves.toBe("/source-media/test.png");
    expect(steps).toEqual([
      "navigation",
      "page stable",
      "consent",
      "post-consent",
      "screenshot",
      "store",
    ]);
    expect(context.route).toHaveBeenCalledOnce();
    expect(media.storeImage).toHaveBeenCalledWith(
      Buffer.from("png-test"), "image/png",
    );
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("réalise la capture même si le traitement d'une CMP échoue", async () => {
    vi.mocked(prepareCookieFreeCapture).mockRejectedValueOnce(new Error("iframe detached"));
    const config = { get: vi.fn().mockReturnValue(undefined) };
    const capture = new SourceCaptureService(
      media as unknown as SourceMediaService,
      config as unknown as ConfigService,
    );
    await expect(capture.capture("https://8.8.8.8/")).resolves.toBe("/source-media/test.png");
    expect(page.screenshot).toHaveBeenCalledOnce();
  });
});
