import { dynamicUrl, fetchSeoItems, SEO_KINDS, SEO_LOCALES, sitemapResponse, urlsXml, type SeoKind, type SeoLocale } from "@/lib/seo-sitemap";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ kind: string; locale: string; page: string }> };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const {kind, locale, page} = await params;
  if (!SEO_KINDS.includes(kind as SeoKind) || !SEO_LOCALES.includes(locale as SeoLocale) ||
    !/^(?:0|[1-9]\d{0,3})$/.test(page)) {
    return new Response("Not found", {status:404});
  }
  try {
    const result = await fetchSeoItems(kind as SeoKind, locale as SeoLocale, Number(page));
    if (result.kind !== kind || result.locale !== locale || result.page !== Number(page) ||
      !Array.isArray(result.items) || result.items.length > 1000) throw new Error("Invalid sitemap page");
    // Article collections change when new items are imported; the entity updatedAt
    // timestamp does NOT track these changes, so omit lastmod rather than mislead crawlers.
    const entries = result.items.filter(item => SLUG.test(item.slug) && item.slug.length <= 255)
      .map(item => ({ url: dynamicUrl(kind as SeoKind, locale as SeoLocale, item.slug) }));
    if (!entries.length) return new Response("Not found", {status:404});
    return sitemapResponse(urlsXml(entries));
  } catch {
    return new Response("Sitemap temporarily unavailable", {status:503,headers:{"cache-control":"no-store"}});
  }
}
