import type { CSSProperties } from "react";

import type { CategoryHomeLayout } from "@lmn24/contracts";

import { HomeArticleMedia } from "./HomeArticleMedia";
import { HomeCarousel } from "./HomeCarousel";
import { safeExternalUrl, type HomeArticle, type HomeSectionData } from "./home-data";
import styles from "./home.module.css";

const layoutStyles: Record<CategoryHomeLayout, string> = {
  FEATURED: styles.featured!,
  GRID: styles.grid!,
  LIST: styles.list!,
  SPLIT: styles.split!,
  MOSAIC: styles.mosaic!,
  COMPACT: styles.compact!,
  HEADLINES: styles.headlines!,
  CAROUSEL: styles.carousel!,
};

type Props = {
  section: HomeSectionData;
  label: string;
  locale: string;
  categoryLinkLabel: string;
  previousLabel: string;
  nextLabel: string;
};

function ArticleCard({
  article,
  locale,
  layoutType,
}: {
  article: HomeArticle;
  locale: string;
  layoutType: CategoryHomeLayout;
}) {
  const href = safeExternalUrl(article.articleUrl);
  if (!href) return null;

  const pubDate = new Date(article.publishedAt);
  const validDate = !Number.isNaN(pubDate.getTime());
  const published = validDate
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(pubDate)
    : null;
  const compact = layoutType === "HEADLINES" || layoutType === "COMPACT";

  return (
    <article className={styles.articleCard}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.articleLink}
      >
        {layoutType !== "HEADLINES" && (
          <HomeArticleMedia
            title={article.title}
            imageUrl={article.imageUrl}
            logoUrl={article.source.logoUrl}
          />
        )}
        <div className={styles.articleBody}>
          <div className={styles.articleMeta}>
            <span className={styles.sourceName}>{article.source.name}</span>
            {published && (
              <time dateTime={pubDate.toISOString()}>{published}</time>
            )}
          </div>
          <h3 className={styles.articleTitle}>{article.title}</h3>
          {!compact && article.summary?.trim() && (
            <p className={styles.articleSummary}>{article.summary.trim()}</p>
          )}
        </div>
      </a>
    </article>
  );
}

export function HomeSection({
  section,
  label,
  locale,
  categoryLinkLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const sectionStyle = {
    "--category-accent": section.themeColor,
  } as CSSProperties;

  const articles = section.articles.map((article) => (
    <ArticleCard
      key={article.id}
      article={article}
      locale={locale}
      layoutType={section.layoutType}
    />
  ));

  return (
    <section
      aria-labelledby={"home-section-" + section.id}
      className={styles.categorySection}
      style={sectionStyle}
    >
      <div className={styles.sectionHeading}>
        <div className={styles.headingTitle}>
          <span className={styles.categoryMarker} aria-hidden="true" />
          <h2 id={"home-section-" + section.id} className={styles.categoryName}>
            <a
              href={"/" + encodeURIComponent(locale) + "/category/" + encodeURIComponent(section.slug)}
              aria-label={categoryLinkLabel}
              className={styles.categoryLink}
            >
              {label} <span aria-hidden="true">↗</span>
            </a>
          </h2>
        </div>
      </div>

      {section.layoutType === "CAROUSEL" ? (
        <HomeCarousel
          title={label}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
        >
          {articles}
        </HomeCarousel>
      ) : (
        <div className={styles.articleGrid + " " + layoutStyles[section.layoutType]}>
          {articles}
        </div>
      )}
    </section>
  );
}
