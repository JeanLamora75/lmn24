import { sitemapResponse, staticUrls, urlsXml } from "../../../lib/seo-sitemap";
export function GET(): Response {
  return sitemapResponse(urlsXml(staticUrls().map(url => ({ url }))));
}
