import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getHashtagLabels, hashtagRankingHref, HASHTAG_LABELS,
  parseRankingParams, safeHashtagImage,
} from "./hashtag-ranking-data";

describe("SCRUM-54 — public hashtag ranking filters and navigation", () => {
  it("accepts only the supported periods, modes and positive page numbers", () => {
    expect(parseRankingParams({ period: "30d", mode: "trending", page: "3" }))
      .toEqual({ period: "30d", mode: "trending", page: 3 });
    expect(parseRankingParams({ period: "1year", mode: "admin", page: "-9" }))
      .toEqual({ period: "24h", mode: "most-cited", page: 1 });
    expect(parseRankingParams({ page: "2000000" }).page).toBe(1);
    expect(parseRankingParams({ mode: ["trending", "most-cited"] }).mode).toBe("most-cited");
  });

  it("preserves filters and locale in shareable pagination links", () => {
    expect(hashtagRankingHref("fr", {
      period: "7d", mode: "trending", page: 4,
    })).toBe("/fr/hashtags?period=7d&mode=trending&page=4");
    expect(hashtagRankingHref("ru", {
      period: "24h", mode: "most-cited", page: 1,
    })).toBe("/ru/hashtags?period=24h&mode=most-cited");
  });

  it("provides nonempty headings and notices for all eight supported locales", () => {
    expect(Object.keys(HASHTAG_LABELS).sort())
      .toEqual(["de", "en", "es", "fr", "it", "nl", "pt", "ru"]);
    for (const locale of Object.keys(HASHTAG_LABELS)) {
      const t = getHashtagLabels(locale);
      for (const key of ["title", "trending", "mostCited", "empty", "noTrending",
        "insufficientHistory", "unavailable", "detailsPending", "previous", "next"] as const) {
        expect(t[key].trim().length).toBeGreaterThan(0);
      }
    }
    expect(getHashtagLabels("unknown")).toEqual(HASHTAG_LABELS.fr);
  });

  it("accepts only LMN24-managed WebP images, never remote hotlinks", () => {
    const managed = "/api/media/hashtags/843b5bb4-9292-4091-bd0a-e14b321fe311.webp";
    expect(safeHashtagImage(managed)).toBe(managed);
    expect(safeHashtagImage("https://example.net/foo.jpg")).toBeNull();
    expect(safeHashtagImage("/api/media/hashtags/../../secret.webp")).toBeNull();
    expect(safeHashtagImage(null)).toBeNull();
  });
});

describe("SCRUM-54 — SSR public page and accessible navigation", () => {
  const page = readFileSync(new URL("../../app/[locale]/hashtags/page.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../public/PublicHeader.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../../app/[locale]/hashtags/[slug]/page.tsx", import.meta.url), "utf8");

  it("has period/mode selectors, accessible state and paged cards", () => {
    expect(page).toContain('selected.mode === mode ? "page"');
    expect(page).toContain('selected.period === period ? "page"');
    expect(page).toContain('(["24h", "7d", "30d"] as const)');
    expect(page).toContain('(["most-cited", "trending"] as const)');
    expect(page).toContain('ranking.pagination.totalPages > 1');
    expect(page).toContain('aria-labelledby="hashtag-ranking-heading"');
  });
  it("shows empty/insufficient history/error states and all-language badge", () => {
    expect(page).toContain("labels.insufficientHistory");
    expect(page).toContain("labels.noTrending");
    expect(page).toContain("labels.unavailable");
    expect(page).toContain("labels.allLanguages");
    expect(page).not.toContain('locale="?');
  });
  it("connects the main header and active-only detail route", () => {
    expect(header).toContain('href="/hashtags"');
    expect(header).toContain("navLabels.hashtags");
    expect(detail).toContain("loadHashtag(slug)");
    expect(detail).toContain("if (!subject) notFound()");
  });
});
