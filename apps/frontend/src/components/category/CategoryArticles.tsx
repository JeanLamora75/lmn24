"use client";

import { CATEGORY_NEXT_PAGE_SIZE } from "@lmn24/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArticleCard } from "@/components/home/HomeSection";
import homeStyles from "@/components/home/home.module.css";
import type { HomeArticle } from "@/components/home/home-data";

import {
  appendUniqueArticles,
  arrangeCategoryBlocks,
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
  initialPage: { items: HomeArticle[]; nextCursor: string | null; hasMore: boolean };
  paginationPath: string;
  locale: string;
  labels: Labels;
};

const layouts = {
  FEATURED: homeStyles.featured,
  GRID: homeStyles.grid,
  COMPACT: homeStyles.compact,
} as const;

export function CategoryArticles({ initialPage, paginationPath, locale, labels }: Props) {
  const [articles, setArticles] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [supportsObserver, setSupportsObserver] = useState(true);
  const blocks = arrangeCategoryBlocks(articles);

  const loadNext = useCallback(async () => {
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
      const url = paginationPath + "?" + query.toString();
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("category-next-page-failed");
      const data = (await response.json()) as Props["initialPage"];
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
  }, [hasMore, cursor, locale, paginationPath]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupportsObserver(false);
      return;
    }
    if (!hasMore || !cursor || error || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNext();
      },
      { rootMargin: "0px 0px 300px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, cursor, error, loading, loadNext]);

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
        <div ref={sentinelRef} className={homeStyles.moreNewsWrapper} aria-busy={loading}>
          {loading ? (
            <p role="status" aria-live="polite">{labels.loading}</p>
          ) : error || !supportsObserver ? (
            <button
              type="button"
              onClick={() => void loadNext()}
              className={homeStyles.moreNewsLink}
            >
              {error ? labels.retry : labels.loadMore}
            </button>
          ) : null}
        </div>
      ) : (
        <p role="status" className={styles.endMessage}>{labels.end}</p>
      )}
    </>
  );
}
