import { fetchSeoCounts, indexXml, SEO_ORIGIN, SEO_KINDS, SEO_LOCALES, sitemapResponse } from "../../lib/seo-sitemap";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try {
    const result = await fetchSeoCounts();
    if (result.pageSize !== 1000 || !Array.isArray(result.results)) throw new Error("Invalid sitemap counts");
    const byPair = new Map(result.results.map(entry => [entry.kind + "/" + entry.locale, entry.count]));
    const shards = [SEO_ORIGIN + "/sitemaps/static.xml"];
    for (const kind of SEO_KINDS) {
      for (const locale of SEO_LOCALES) {
        const count = byPair.get(kind + "/" + locale);
        if (!Number.isSafeInteger(count) || count === undefined || count < 0) throw new Error("Invalid sitemap counts");
        // Hard limit prevents generating unbounded XML indexes from invalid responses.
        if (count > 10000000) throw new Error("Sitemap index too large");
        for (let page = 0; page < Math.ceil(count / result.pageSize); page++) {
          shards.push(SEO_ORIGIN + "/sitemaps/" + kind + "/" + locale + "/" + page);
        }
      }
    }
    return sitemapResponse(indexXml(shards));
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}
