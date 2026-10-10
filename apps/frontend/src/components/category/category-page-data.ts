import {
  CATEGORY_COMPACT_SIZE,
  CATEGORY_FEATURED_SIZE,
  CATEGORY_GRID_SIZE,
} from "@lmn24/contracts";

import type { HomeArticle } from "@/components/home/home-data";

export type CategoryPageResponse = {
  category: { id: string; slug: string; themeColor: string };
  items: HomeArticle[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type CategoryArticleBlock = {
  layout: "FEATURED" | "GRID" | "COMPACT";
  items: HomeArticle[];
};

/** FEATURED(5) once, then GRID(6) / COMPACT(8) until exhaustion. */
export function arrangeCategoryBlocks(items: readonly HomeArticle[]): CategoryArticleBlock[] {
  const result: CategoryArticleBlock[] = [];
  let offset = 0;
  let blockNumber = 0;
  while (offset < items.length) {
    const layout = blockNumber === 0
      ? "FEATURED" as const
      : blockNumber % 2 === 1
        ? "GRID" as const
        : "COMPACT" as const;
    const capacity = layout === "FEATURED"
      ? CATEGORY_FEATURED_SIZE
      : layout === "GRID"
        ? CATEGORY_GRID_SIZE
        : CATEGORY_COMPACT_SIZE;
    result.push({ layout, items: items.slice(offset, offset + capacity) });
    offset += capacity;
    blockNumber++;
  }
  return result;
}

/** Defensive de-duplication if the source changes while a reader paginates. */
export function appendUniqueArticles(
  current: readonly HomeArticle[],
  incoming: readonly HomeArticle[],
): HomeArticle[] {
  const ids = new Set(current.map((item) => item.id));
  const result = [...current];
  for (const item of incoming) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    result.push(item);
  }
  return result;
}
