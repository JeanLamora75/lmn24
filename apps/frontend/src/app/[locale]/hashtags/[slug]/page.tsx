import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryArticles } from "@/components/category/CategoryArticles";
import type { HomeArticle } from "@/components/home/home-data";
import categoryStyles from "@/components/category/category.module.css";
import { HashtagThumbnail } from "@/components/hashtags/HashtagThumbnail";
import { getHashtagLabels } from "@/components/hashtags/hashtag-ranking-data";
import styles from "@/components/hashtags/hashtags.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";
type Props = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;
type PublicHashtag = { id: string; name: string; slug: string; imageUrl: string | null };
type PublicHashtagPage = {
  hashtag: PublicHashtag;
  items: HomeArticle[];
  hasMore: boolean;
  nextCursor: string | null;
};
type CategoryLabels = {
  articles: string; empty: string; error: string; loadMore: string;
  loading: string; retry: string; loadError: string; end: string;
};

async function loadHashtag(slug: string): Promise<PublicHashtag | null> {
  try {
    const response = await fetch(getBackendUrl() + "/hashtags/" + encodeURIComponent(slug), {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const item = await response.json() as PublicHashtag;
    if (!item || item.slug !== slug || !item.name) return null;
    return item;
  } catch { return null; }
}

async function loadFirstArticles(slug: string): Promise<PublicHashtagPage | "not-found" | null> {
  try {
    const response = await fetch(
      getBackendUrl() + "/public/hashtags/" + encodeURIComponent(slug) + "/articles",
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    if (response.status === 404) return "not-found";
    if (!response.ok) return null;
    const data = await response.json() as PublicHashtagPage;
    if (!data || !data.hashtag || data.hashtag.slug !== slug ||
        !Array.isArray(data.items) || typeof data.hasMore !== "boolean" ||
        (data.hasMore && !data.nextCursor)) return null;
    return data;
  } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { title: "Hashtags | LMN24" };
  }
  const subject = await loadHashtag(slug);
  return { title: subject?.name ?? "Hashtags" };
}

export default async function PublicHashtagDetail({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) ||
      slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  setRequestLocale(locale);
  const [data, messages] = await Promise.all([
    loadFirstArticles(slug), getMessages({ locale }),
  ]);
  if (data === "not-found") notFound();
  const labels = getHashtagLabels(locale);
  const categoryLabels = messages.categoryPage as CategoryLabels;

  // If the articles endpoint is temporarily unavailable, the active-only
  // public profile can still render the subject, but no private data leaks.
  const subject = data?.hashtag ?? await loadHashtag(slug);
  if (!subject) notFound();

  const accent = { "--category-accent": "#0D6EFD" } as CSSProperties;
  return (
    <main className={"container px-3 px-lg-4 " + categoryStyles.page} style={accent}>
      <nav aria-label={labels.back} className="mt-4 mb-3">
        <Link href={"/" + locale + "/hashtags"} className="text-decoration-none">
          ← {labels.back}
        </Link>
      </nav>
      <section className="row g-4 align-items-center mb-4 py-3" aria-labelledby="hashtag-detail-title">
        <div className="col-lg-4">
          <HashtagThumbnail imageUrl={subject.imageUrl} name={subject.name} size="detail" />
        </div>
        <div className="col-lg-8">
          <h1 id="hashtag-detail-title" className={categoryStyles.title}>{subject.name}</h1>
          <p className="text-body-secondary mt-3 mb-0">{labels.allLanguages}</p>
        </div>
      </section>

      <section aria-label={categoryLabels.articles} className={styles.page}>
        {data === null ? (
          <p className="alert alert-danger" role="alert">
            {categoryLabels.error}{" "}
            <a href={"/" + locale + "/hashtags/" + encodeURIComponent(slug)}>{categoryLabels.retry}</a>
          </p>
        ) : data.items.length === 0 ? (
          <p className={categoryStyles.empty} role="status">{categoryLabels.empty}</p>
        ) : (
          <CategoryArticles
            initialPage={data}
            paginationPath={"/api/public/hashtags/" + encodeURIComponent(slug) + "/articles"}
            locale={locale}
            labels={categoryLabels}
          />
        )}
      </section>
    </main>
  );
}
