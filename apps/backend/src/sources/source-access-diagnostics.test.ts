import { UnprocessableEntityException } from "@nestjs/common";
import type { Page, Response as PlaywrightResponse } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { assertSiteAccessible, isAccessChallenge } from "./source-access-diagnostics";

function page(title: string, body: string): Page {
  return { evaluate: vi.fn(async () => ({ title, body })) } as unknown as Page;
}
function response(status: number): PlaywrightResponse {
  return { status: () => status } as PlaywrightResponse;
}

describe("SCRUM-16/30 — access denials and anti-bot pages", () => {
  it("rejects HTTP 403/429 before saving an image or parsing social links", async () => {
    for (const status of [403, 429]) {
      const target = page("Journal", "Accueil");
      await expect(assertSiteAccessible(target, response(status), "capture"))
        .rejects.toThrow(UnprocessableEntityException);
      expect(target.evaluate).not.toHaveBeenCalled();
    }
  });

  it("rejects an explicit access challenge with HTTP 200", async () => {
    await expect(assertSiteAccessible(
      page("Attention Required!", "Sorry, you have been blocked."),
      response(200), "social",
    )).rejects.toThrow(UnprocessableEntityException);
    expect(isAccessChallenge("Bot detected", "Security check")).toBe(true);
  });

  it("accepts a normal public homepage", async () => {
    await expect(assertSiteAccessible(
      page("International Journal", "International and local stories"),
      response(200), "capture",
    )).resolves.toBeUndefined();
    expect(isAccessChallenge("News", "Example article about internet safety")).toBe(false);
  });
});
