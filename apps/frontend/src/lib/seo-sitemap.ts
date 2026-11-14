import { getBackendUrl } from "./admin-backend";

export const SEO_ORIGIN = "https://www.lmn24.com";
export const SEO_LOCALES = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"] as const;
export const SEO_KINDS = ["categories", "sources", "hashtags"] as const;
export type SeoKind = (typeof SEO_KINDS)[number];
export type SeoLocale = (typeof SEO_LOCALES)[number];

export function xmlEscape(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function sitemapResponse(xml: string, status = 200): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n' + xml, {
    status, headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "x-content-type-options": "nosniff",
    },
  });
}

export function urlsXml(items: { url: string; lastModified?: string }[]): string {
  return '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    items.map(item => '<url><loc>' + xmlEscape(item.url) + '</loc>' +
      (item.lastModified ? '<lastmod>' + xmlEscape(item.lastModified) + '</lastmod>' : "") +
      '</url>').join("") + '</urlset>';
}

export function indexXml(urls: string[]): string {
  return '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(url => '<sitemap><loc>' + xmlEscape(url) + '</loc></sitemap>').join("") +
    '</sitemapindex>';
}

async function publicSeo<T>(path: string): Promise<T> {
  const response = await fetch(getBackendUrl() + path, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("SEO_DISCOVERY_FAILED");
  return await response.json() as T;
}

export type SeoCounts = { pageSize: number; results: {kind: SeoKind; locale: SeoLocale; count: number}[] };
export async function fetchSeoCounts(): Promise<SeoCounts> {
  return publicSeo<SeoCounts>("/public/seo/sitemap-counts");
}

export type SeoItems = { kind: SeoKind; locale: SeoLocale; page: number;
  items: { slug: string; lastModified: string }[] };
export async function fetchSeoItems(kind: SeoKind, locale: SeoLocale, page: number): Promise<SeoItems> {
  return publicSeo<SeoItems>("/public/seo/sitemap-items?" +
    new URLSearchParams({kind, locale, page: String(page)}));
}

export function dynamicUrl(kind: SeoKind, locale: SeoLocale, slug: string): string {
  const prefix = kind === "categories" ? "category" : kind === "sources" ? "source" : "hashtags";
  return SEO_ORIGIN + "/" + locale + "/" + prefix + "/" + encodeURIComponent(slug);
}

export function staticUrls(): string[] {
  const sections = ["", "/videos", "/hashtags", "/horoscope", "/weather"];
  const signs = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra",
    "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
  return SEO_LOCALES.flatMap(locale => [
    ...sections.map(section => SEO_ORIGIN + "/" + locale + section),
    ...signs.map(sign => SEO_ORIGIN + "/" + locale + "/horoscope/" + sign),
  ]);
}
