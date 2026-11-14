import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { DEFAULT_CATEGORY_HOME_COLOR } from "@lmn24/contracts";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryArticles } from "@/components/category/CategoryArticles";
import { StructuredData } from "@/components/seo/StructuredData";
import { PublicBreadcrumbs } from "@/components/seo/PublicBreadcrumbs";
import { collectionSchema } from "@/lib/seo-schema";
import type { CategoryPageResponse } from "@/components/category/category-page-data";
import styles from "@/components/category/category.module.css";
import { localizedCategoryHref } from "@/components/home/home-data";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";
import { getSeoAvailableLocales } from "@/lib/seo-availability";
import { seoAlternates, seoUnavailable, type SeoLocale } from "@/lib/seo-metadata";
import { seoSocial, SEO_COPY, cleanSeoText } from "@/lib/seo-social";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ locale: string; slug: string }>;
}>;

type CategoryTranslations = {
  articles: string;
  empty: string;
  error: string;
  loadMore: string;
  loading: string;
  retry: string;
  loadError: string;
  end: string;
};

async function loadFirstPage(
  locale: string,
  slug: string,
): Promise<CategoryPageResponse | "not-found" | null> {
  try {
    const response = await fetch(
      getBackendUrl() + "/public/categories/" + encodeURIComponent(slug) +
        "/articles?locale=" + encodeURIComponent(locale),
      { cache: "no-store" },
    );
    if (response.status === 404) return "not-found";
    if (!response.ok) return null;
    const payload = (await response.json()) as CategoryPageResponse;
    if (
      !payload.category ||
      payload.category.slug !== slug ||
      !Array.isArray(payload.items) ||
      typeof payload.hasMore !== "boolean" ||
      (payload.hasMore && !payload.nextCursor)
    ) {
      return null;
    }
    return payload;
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
  const available = await getSeoAvailableLocales("categories", slug);
  // Missing or empty language variants must never be treated as equivalents.
  if (!available?.includes(locale as SeoLocale)) return seoUnavailable;
  const lang = locale as SeoLocale;
  const messages = await getMessages({ locale });
  const categoryNames = messages.categories as Record<string, string>;
  const label = cleanSeoText(categoryNames[slug] ?? slug.replace(/-/g, " "), 90) ?? slug;
  const title = label + " — " + SEO_COPY[lang].category;
  const description = SEO_COPY[lang].categoryDescription(label);
  const url = "https://www.lmn24.com/" + locale + "/category/" + slug;
  return { title, description,
    alternates: seoAlternates(lang, "category", slug, available),
    ...seoSocial(lang, title + " | LMN24", description, url) };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (
    !hasLocale(routing.locales, locale) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const t = messages.categoryPage as CategoryTranslations;
  const categoryNames = messages.categories as Record<string, string>;
  const label = categoryNames[slug] ?? slug.replace(/-/g, " ");
  const page = await loadFirstPage(locale, slug);
  if (page === "not-found") notFound();
  const color = page && /^#[0-9a-fA-F]{6}$/.test(page.category.themeColor)
    ? page.category.themeColor
    : DEFAULT_CATEGORY_HOME_COLOR;
  const sectionStyle = { "--category-accent": color } as CSSProperties;

  return (
    <main className={"container px-3 px-lg-4 " + styles.page} style={sectionStyle}>
      {page && <StructuredData data={collectionSchema({locale:locale as SeoLocale,
        url:"https://www.lmn24.com/"+locale+"/category/"+slug,name:label,
        description:SEO_COPY[locale as SeoLocale].categoryDescription(label),
        breadcrumbs:[{name:"LMN24",url:"https://www.lmn24.com/"+locale},
          {name:label,url:"https://www.lmn24.com/"+locale+"/category/"+slug}],
      })}/>}
      <PublicBreadcrumbs label={t.articles} items={[
        { label: "LMN24", href: "/" + locale }, { label },
      ]} />
      <header className={styles.heading}>
        <h1 className={styles.title}>{label}</h1>
      </header>

      {page === null ? (
        <div className="alert alert-danger" role="alert">
          {t.error}{" "}
          <a href={localizedCategoryHref(locale, slug)}>{t.retry}</a>
        </div>
      ) : page.items.length === 0 ? (
        <p className={styles.empty} role="status">{t.empty}</p>
      ) : (
        <CategoryArticles initialPage={page} paginationPath={"/api/public/categories/" + encodeURIComponent(slug) + "/articles"} locale={locale} labels={t} />
      )}
    </main>
  );
}
