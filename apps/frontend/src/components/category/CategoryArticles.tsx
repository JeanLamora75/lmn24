"use client";

import { CATEGORY_NEXT_PAGE_SIZE } from "@lmn24/contracts";
import { useRef, useState } from "react";

import { ArticleCard } from "@/components/home/HomeSection";
import homeStyles from "@/components/home/home.module.css";

import {
  appendUniqueArticles,
  arrangeCategoryBlocks,
  type CategoryPageResponse,
} from "./category-page-data";
import styles from "./category.module.css";

type Labels = {
  articles: string;
  loadMore: string;
  loading: string;
  retry: string;
  loadError: string;
  end: string;
};

type Props = {
  initialPage: CategoryPageResponse;
  locale: string;
  labels: Labels;
};

const layouts = {
  FEATURED: homeStyles.featured,
  GRID: homeStyles.grid,
  COMPACT: homeStyles.compact,
} as const;

export function CategoryArticles({ initialPage, locale, labels }: Props) {
  const [articles, setArticles] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const blocks = arrangeCategoryBlocks(articles);

  async function loadNext() {
    if (busy.current || !hasMore || !cursor) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams({
        locale,
        cursor,
        limit: String(CATEGORY_NEXT_PAGE_SIZE),
      });
      const url = "/api/public/categories/" +
        encodeURIComponent(initialPage.category.slug) +
        "/articles?" + query.toString();
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("category-next-page-failed");
      const data = (await response.json()) as CategoryPageResponse;
      if (
        !Array.isArray(data.items) ||
        typeof data.hasMore !== "boolean" ||
        (data.hasMore && (!data.nextCursor || data.items.length === 0))
      ) {
        throw new Error("category-next-page-invalid");
      }
      setArticles((current) => appendUniqueArticles(current, data.items));
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.blocks} aria-label={labels.articles}>
        {blocks.map((block, index) => (
          <div className={styles.block} key={index}>
            <div className={homeStyles.articleGrid + " " + layouts[block.layout]}>
              {block.items.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  locale={locale}
                  layoutType={block.layout}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="alert alert-danger mt-4" role="alert">{labels.loadError}</p>
      )}
      {hasMore ? (
        <div className={homeStyles.moreNewsWrapper}>
          <button
            type="button"
            onClick={() => void loadNext()}
            disabled={loading}
            aria-busy={loading}
            className={homeStyles.moreNewsLink}
          >
            {loading ? labels.loading : error ? labels.retry : labels.loadMore}
          </button>
        </div>
      ) : (
        <p role="status" className={styles.endMessage}>{labels.end}</p>
      )}
    </>
  );
}
