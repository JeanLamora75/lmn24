import { describe, expect, it } from "vitest";

import type { HomeArticle } from "@/components/home/home-data";
import { appendUniqueArticles, arrangeCategoryBlocks } from "./category-page-data";

function article(id: number): HomeArticle {
  return {
    id: String(id),
    title: "Article " + id,
    summary: null,
    imageUrl: null,
    articleUrl: "https://example.org/story/" + id,
    publishedAt: new Date(2026, 9, 10, 12, 0, -id).toISOString(),
    source: { name: "Source", logoUrl: null },
  };
}
const items = (count: number) => Array.from({ length: count }, (_, i) => article(i));

describe("SCRUM-27 — répartition exhaustive des cartes", () => {
  it("ne produit aucun bloc pour une catégorie vide", () => {
    expect(arrangeCategoryBlocks([])).toEqual([]);
  });

  it("affiche un FEATURED même lorsque la catégorie n'a qu'un article", () => {
    const blocks = arrangeCategoryBlocks(items(1));
    expect(blocks.map((x) => [x.layout, x.items.length])).toEqual([["FEATURED", 1]]);
  });

  it("utilise les capacités FEATURED 5, GRID 6, COMPACT 8 dans cet ordre", () => {
    const blocks = arrangeCategoryBlocks(items(36));
    expect(blocks.map((x) => [x.layout, x.items.length])).toEqual([
      ["FEATURED", 5], ["GRID", 6], ["COMPACT", 8],
      ["GRID", 6], ["COMPACT", 8], ["GRID", 3],
    ]);
  });

  it("rend 125 articles une seule fois, en conservant leur ordre", () => {
    const source = items(125);
    const rendered = arrangeCategoryBlocks(source).flatMap((b) => b.items);
    expect(rendered).toHaveLength(125);
    expect(rendered.map((item) => item.id)).toEqual(source.map((item) => item.id));
  });

  it("ajoute les lots successifs en évitant les doublons", () => {
    const first = items(19);
    const second = [...items(2).slice(-1), ...items(33).slice(19)];
    const accumulated = appendUniqueArticles(first, second);
    expect(accumulated).toHaveLength(33);
    expect(arrangeCategoryBlocks(accumulated).map((b) => b.items.length)).toEqual([5, 6, 8, 6, 8]);
  });
});
