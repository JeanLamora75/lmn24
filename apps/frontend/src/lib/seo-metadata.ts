import type { Metadata } from "next";

export const SEO_SITE = "https://www.lmn24.com";
export const SEO_LANGUAGES = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"] as const;
export type SeoLocale = (typeof SEO_LANGUAGES)[number];

export function seoPath(locale: SeoLocale, section = "", slug?: string): string {
  const path = "/" + locale + (section ? "/" + section : "") +
    (slug ? "/" + encodeURIComponent(slug) : "");
  return path;
}

export function seoAlternates(
  locale: SeoLocale,
  section = "",
  slug?: string,
  availableLocales: readonly SeoLocale[] = SEO_LANGUAGES,
): NonNullable<Metadata["alternates"]> {
  const path = seoPath(locale, section, slug);
  const normalized = SEO_LANGUAGES.filter(lang => availableLocales.includes(lang));
  return {
    canonical: SEO_SITE + path,
    // No x-default yet: the root / redirects using visitor language detection,
    // so it is not a stable neutral language-selector URL.
    ...(normalized.length > 1 ? {
      languages: Object.fromEntries(normalized.map(lang =>
        [lang, SEO_SITE + seoPath(lang, section, slug)])),
    } : {}),
  };
}

export const seoUnavailable: Metadata = {
  robots: { index: false, follow: false },
};
