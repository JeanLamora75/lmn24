import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TV_GUIDE_PUBLIC_ENABLED } from "@/lib/tv-guide-release";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../../app/[locale]/page.tsx", import.meta.url), "utf8");

describe("LMN24 Guide TV — no public release without owner GO", () => {
  it("keeps the public release gate disabled", () => {
    expect(TV_GUIDE_PUBLIC_ENABLED).toBe(false);
  });

  it("has no TV Guide link or button in public header, footer or homepage", () => {
    for (const content of [header, footer, homepage]) {
      expect(content).not.toMatch(/programme[ -]?tv|programmes[ -]?tv|tv[ -]?guide|guide[ -]?tv/i);
    }
  });
});
