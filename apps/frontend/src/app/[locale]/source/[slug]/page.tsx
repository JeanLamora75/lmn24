import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryArticles } from "@/components/category/CategoryArticles";
import { StructuredData } from "@/components/seo/StructuredData";
import { PublicBreadcrumbs } from "@/components/seo/PublicBreadcrumbs";
import { collectionSchema } from "@/lib/seo-schema";
import styles from "@/components/category/category.module.css";
import type { HomeArticle } from "@/components/home/home-data";
import { SourceProfile, type PublicSource } from "@/components/source/SourceProfile";
import sourceStyles from "@/components/source/source.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";
import { getSeoAvailableLocales } from "@/lib/seo-availability";
import { seoAlternates, seoUnavailable, type SeoLocale } from "@/lib/seo-metadata";
import { seoSocial, SEO_COPY, cleanSeoText } from "@/lib/seo-social";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 255) {
    return seoUnavailable;
  }
  const available = await getSeoAvailableLocales("sources", slug);
  // Missing or empty language variants must never be treated as equivalents.
  if (!available?.includes(locale as SeoLocale)) return seoUnavailable;
  const lang = locale as SeoLocale;
  const page = await loadFirstPage(locale, slug);
  if (!page || page === "not-found") return seoUnavailable;
  const name = cleanSeoText(page.source.name, 90);
  if (!name) return seoUnavailable;
  const title = name + " — " + SEO_COPY[lang].source;
  const description = cleanSeoText(page.source.description) ??
    SEO_COPY[lang].sourceDescription(name);
  const url = "https://www.lmn24.com/" + locale + "/source/" + slug;
  return { title, description,
    alternates: seoAlternates(lang, "source", slug, available),
    ...seoSocial(lang, title + " | LMN24", description, url) };
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
      {page && <StructuredData data={collectionSchema({locale:locale as SeoLocale,
        url:"https://www.lmn24.com/"+locale+"/source/"+slug,
        name:page.source.name,
        description:page.source.description?.trim() ||
          SEO_COPY[locale as SeoLocale].sourceDescription(page.source.name),
        breadcrumbs:[{name:"LMN24",url:"https://www.lmn24.com/"+locale},
          {name:page.source.name,url:"https://www.lmn24.com/"+locale+"/source/"+slug}],
      })}/>}
      {page === null ? (
        <div className="alert alert-danger" role="alert">
          {labels.error}{" "}
          <a href={"/" + encodeURIComponent(locale) + "/source/" + encodeURIComponent(slug)}>
            {labels.retry}
          </a>
        </div>
      ) : (
        <>
          <PublicBreadcrumbs label={labels.articles} items={[
            { label: "LMN24", href: "/" + locale }, { label: page.source.name },
          ]} />
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
