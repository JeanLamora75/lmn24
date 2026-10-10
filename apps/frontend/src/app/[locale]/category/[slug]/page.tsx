import type { CSSProperties } from "react";
import { DEFAULT_CATEGORY_HOME_COLOR } from "@lmn24/contracts";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryArticles } from "@/components/category/CategoryArticles";
import type { CategoryPageResponse } from "@/components/category/category-page-data";
import styles from "@/components/category/category.module.css";
import { localizedCategoryHref } from "@/components/home/home-data";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

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
        <CategoryArticles initialPage={page} locale={locale} labels={t} />
      )}
    </main>
  );
}
