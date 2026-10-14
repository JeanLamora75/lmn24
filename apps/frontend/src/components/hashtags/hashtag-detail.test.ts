import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appendUniqueArticles, arrangeCategoryBlocks } from "../category/category-page-data";
import type { HomeArticle } from "../home/home-data";

const page = readFileSync(new URL("../../app/[locale]/hashtags/[slug]/page.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../../app/api/public/hashtags/[slug]/articles/route.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../../backend/src/hashtags/public-hashtag-articles.service.ts", import.meta.url), "utf8");

const fake = (index: number): HomeArticle => ({
  id: String(index), title: "Москва " + index, summary: null,
  articleUrl: "https://news.example/" + index, imageUrl: null,
  publishedAt: new Date(2026, 9, 13, 12, 0, -index).toISOString(),
  source: { name: "World", logoUrl: null, countryIsoCode2: index % 2 ? "FR" : "RU" },
});

describe("SCRUM-55 — hashtag detail reuses existing category presentation", () => {
  it("renders the canonical category grid component with the hashtag pagination path", () => {
    expect(page).toContain("CategoryArticles");
    expect(page).toContain('paginationPath={"/api/public/hashtags/"');
    expect(page).toContain("HashtagThumbnail");
    expect(page).toContain("categoryLabels.empty");
    expect(page).toContain('if (data === "not-found") notFound()');
  });

  it("keeps the featured+grids layout and unique chronological articles", () => {
    const articles = Array.from({ length: 34 }, (_, i) => fake(i));
    const blocks = arrangeCategoryBlocks(articles);
    expect(blocks.map((b) => [b.layout, b.items.length]))
      .toEqual([["FEATURED", 5], ["GRID", 6], ["COMPACT", 8], ["GRID", 6], ["COMPACT", 8], ["GRID", 1]]);
    const appended = appendUniqueArticles(articles.slice(0, 19), articles.slice(18));
    expect(appended.map((x) => x.id)).toEqual(articles.map((x) => x.id));
  });

  it("does not filter by page locale and forwards only safe pagination keys", () => {
    expect(proxy).toContain('for (const key of ["cursor", "limit"])');
    expect(backend).not.toContain("languageIsoCode2:");
    expect(backend).toContain("matchArticleHashtags");
  });

  it("uses the normal article card component for country flags and safe external links", () => {
    const component = readFileSync(new URL("../category/CategoryArticles.tsx", import.meta.url), "utf8");
    expect(component).toContain("ArticleCard");
    expect(page).toContain('labels={categoryLabels}');
  });
});
