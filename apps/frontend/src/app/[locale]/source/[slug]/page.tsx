import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryArticles } from "@/components/category/CategoryArticles";
import styles from "@/components/category/category.module.css";
import type { HomeArticle } from "@/components/home/home-data";
import { SourceProfile, type PublicSource } from "@/components/source/SourceProfile";
import sourceStyles from "@/components/source/source.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

type Labels = {
  articles: string;
  empty: string;
  error: string;
  loadMore: string;
  loading: string;
  retry: string;
  loadError: string;
  end: string;
};

type SourcePageResponse = {
  source: PublicSource;
  items: HomeArticle[];
  hasMore: boolean;
  nextCursor: string | null;
};

async function loadFirstPage(
  locale: string,
  slug: string,
): Promise<SourcePageResponse | "not-found" | null> {
  try {
    const response = await fetch(
      getBackendUrl() + "/public/sources/" + encodeURIComponent(slug) +
        "/articles?locale=" + encodeURIComponent(locale),
      { cache: "no-store" },
    );
    if (response.status === 404) return "not-found";
    if (!response.ok) return null;
    const data = (await response.json()) as SourcePageResponse;
    if (
      !data.source ||
      data.source.slug !== slug ||
      !data.source.name ||
      !Array.isArray(data.items) ||
      typeof data.hasMore !== "boolean" ||
      (data.hasMore && !data.nextCursor)
    ) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function PublicSourcePage({ params }: Props) {
  const { locale, slug } = await params;
  if (
    !hasLocale(routing.locales, locale) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 255
  ) notFound();
  setRequestLocale(locale);

  const messages = await getMessages({ locale });
  const labels = messages.categoryPage as Labels;
  const page = await loadFirstPage(locale, slug);
  if (page === "not-found") notFound();

  return (
    <main className={"container px-3 px-lg-4 " + sourceStyles.page}>
      {page === null ? (
        <div className="alert alert-danger" role="alert">
          {labels.error}{" "}
          <a href={"/" + encodeURIComponent(locale) + "/source/" + encodeURIComponent(slug)}>
            {labels.retry}
          </a>
        </div>
      ) : (
        <>
          <SourceProfile source={page.source} />
          <section aria-label={labels.articles}>
            {page.items.length === 0 ? (
              <p className={styles.empty} role="status">{labels.empty}</p>
            ) : (
              <CategoryArticles
                initialPage={page}
                paginationPath={"/api/public/sources/" + encodeURIComponent(slug) + "/articles"}
                locale={locale}
                labels={labels}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}
