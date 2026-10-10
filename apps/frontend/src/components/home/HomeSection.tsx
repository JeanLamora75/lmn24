import type { CSSProperties } from "react";
import Link from "next/link";

import type { CategoryHomeLayout } from "@lmn24/contracts";

import { CountryFlag } from "./CountryFlag";
import { HomeArticleMedia } from "./HomeArticleMedia";
import { HomeCarousel } from "./HomeCarousel";
import {
  localizedCategoryHref,
  safeExternalUrl,
  type HomeArticle,
  type HomeSectionData,
} from "./home-data";
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
  moreNewsLabel: string;
  previousLabel: string;
  nextLabel: string;
};

export function ArticleCard({
  article,
  locale,
  layoutType,
}: {
  article: HomeArticle;
  locale: string;
  layoutType: CategoryHomeLayout;
}) {
  const href = safeExternalUrl(article.articleUrl);
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

  const content = (
    <>
      {layoutType !== "HEADLINES" && (
        <HomeArticleMedia
          imageUrl={article.imageUrl}
          logoUrl={article.source.logoUrl}
        />
      )}
      <div className={styles.articleBody}>
        <div className={styles.articleMeta}>
          <span className={styles.sourceIdentity}>
            <CountryFlag
              countryIsoCode2={article.source.countryIsoCode2}
              locale={locale}
            />
            <span className={styles.sourceName}>{article.source.name}</span>
          </span>
          {published && (
            <time dateTime={pubDate.toISOString()}>{published}</time>
          )}
        </div>
        <h3 className={styles.articleTitle}>{article.title}</h3>
        {!compact && article.summary?.trim() && (
          <p className={styles.articleSummary}>{article.summary.trim()}</p>
        )}
      </div>
    </>
  );

  return (
    <article className={styles.articleCard}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.articleLink}
        >
          {content}
        </a>
      ) : (
        <div className={styles.articleLink}>{content}</div>
      )}
    </article>
  );
}

export function HomeSection({
  section,
  label,
  locale,
  categoryLinkLabel,
  moreNewsLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const sectionStyle = {
    "--category-accent": section.themeColor,
  } as CSSProperties;
  const categoryHref = localizedCategoryHref(locale, section.slug);

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
              href={categoryHref}
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

      <div className={styles.moreNewsWrapper}>
        <Link
          href={categoryHref}
          className={styles.moreNewsLink}
          aria-label={moreNewsLabel + " — " + label}
        >
          {moreNewsLabel}
        </Link>
      </div>
    </section>
  );
}
