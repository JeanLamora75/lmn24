import { describe, expect, it } from "vitest";

import {
  localizedCategoryHref,
  prepareHomeSections,
  safeExternalUrl,
  type HomeArticle,
  type HomeSectionData,
} from "./home-data";

const article = (id: string, publishedAt = "2026-10-09T10:00:00Z"): HomeArticle => ({
  id,
  title: "Article " + id,
  articleUrl: "https://example.org/" + id,
  summary: null,
  imageUrl: null,
  publishedAt,
  source: { name: "Example", logoUrl: null, countryIsoCode2: "FR" },
});

const section = (
  layoutType: HomeSectionData["layoutType"],
  articles: HomeArticle[],
  order = 2,
): HomeSectionData => ({
  id: layoutType,
  slug: "news",
  displayOrder: order,
  layoutType,
  themeColor: "#11aa22",
  articles,
});

describe("SCRUM-26 — navigation vers les actualités de la catégorie", () => {
  it("conserve la locale sélectionnée pour chacune des sept langues", () => {
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru"]) {
      expect(localizedCategoryHref(locale, "sports")).toBe(
        "/" + locale + "/category/sports",
      );
    }
  });

  it("encode le slug et conserve la locale dans l'URL", () => {
    expect(localizedCategoryHref("fr", "faits-divers")).toBe(
      "/fr/category/faits-divers",
    );
    expect(localizedCategoryHref("de", "culture & société")).toBe(
      "/de/category/culture%20%26%20soci%C3%A9t%C3%A9",
    );
  });
});

describe("SCRUM-26 — rendu des sections", () => {
  it("utilise les capacités fixes de chacun des huit modèles", () => {
    const capacities = {
      FEATURED: 5,
      GRID: 6,
      LIST: 5,
      SPLIT: 3,
      MOSAIC: 5,
      COMPACT: 8,
      HEADLINES: 10,
      CAROUSEL: 6,
    } as const;
    for (const [layout, capacity] of Object.entries(capacities)) {
      const articles = Array.from({ length: 15 }, (_, i) => article(String(i)));
      const rendered = prepareHomeSections([
        section(layout as HomeSectionData["layoutType"], articles),
      ]);
      expect(rendered[0]?.articles).toHaveLength(capacity);
    }
  });

  it("masque les catégories vides et conserve les catégories avec un seul article", () => {
    const data = [
      section("FEATURED", [], 1),
      section("SPLIT", [article("1")], 3),
    ];
    expect(prepareHomeSections(data).map((item) => item.layoutType)).toEqual([
      "SPLIT",
    ]);
    expect(prepareHomeSections(data)[0]?.articles).toHaveLength(1);
  });

  it("classe les catégories par position et les articles par date/id décroissants", () => {
    const data = [
      section("GRID", [
        article("aaa", "2026-10-07T10:00:00Z"),
        article("bbb", "2026-10-09T10:00:00Z"),
        article("ccc", "2026-10-09T10:00:00Z"),
      ], 8),
      section("LIST", [article("x")], 2),
    ];
    const result = prepareHomeSections(data);
    expect(result.map((item) => item.layoutType)).toEqual(["LIST", "GRID"]);
    expect(result[1]?.articles.map((item) => item.id)).toEqual([
      "ccc", "bbb", "aaa",
    ]);
  });

  it("écarte les articles sans URL HTTP(S), sans titre ou sans date", () => {
    const bad = {
      ...article("bad"),
      articleUrl: "javascript:alert(1)",
    };
    const untitled = { ...article("untitled"), title: "" };
    const undated = { ...article("undated"), publishedAt: "invalid" };
    const rendered = prepareHomeSections([
      section("GRID", [bad, untitled, undated, article("good")]),
    ]);
    expect(rendered[0]?.articles.map((item) => item.id)).toEqual(["good"]);
  });

  it("rejette les protocoles interdits pour les liens et images", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,a")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl("https://example.org/a")).toBe(
      "https://example.org/a",
    );
  });

  it("applique une couleur accessible par défaut lorsque le format est invalide", () => {
    const invalid = { ...section("LIST", [article("a")]), themeColor: "red" };
    const prepared = prepareHomeSections([invalid]);
    expect(prepared[0]?.themeColor).toBe("#2563EB");
  });
});
