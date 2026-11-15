import { describe, expect, it } from "vitest";
import { dynamicUrl, indexXml, SEO_LOCALES, staticUrls, urlsXml, xmlEscape } from "./seo-sitemap";

describe("SCRUM-94 sitemap XML and public URL filtering", () => {
  it("escapes XML metacharacters without corrupting canonical URLs", () => {
    expect(xmlEscape('a&<>"\'')).toBe("a&amp;&lt;&gt;&quot;&apos;");
    const xml = urlsXml([{url:"https://www.lmn24.com/fr?x=1&y=2"}]);
    expect(xml).toContain("https://www.lmn24.com/fr?x=1&amp;y=2");
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
  it("uses absolute HTTPS canonical URLs and never includes admin or API", () => {
    const urls = staticUrls();
    expect(urls).toHaveLength(8 * (5 + 12));
    for (const locale of SEO_LOCALES) {
      expect(urls).toContain("https://www.lmn24.com/" + locale);
      expect(urls).toContain("https://www.lmn24.com/" + locale + "/horoscope/aries");
    }
    expect(urls.every(url => url.startsWith("https://www.lmn24.com/"))).toBe(true);
    expect(urls.some(url => /\/admin|\/api/.test(url))).toBe(false);
    expect(dynamicUrl("categories", "en", "world-news")).toBe("https://www.lmn24.com/en/category/world-news");
    expect(dynamicUrl("sources", "fr", "le-monde")).toBe("https://www.lmn24.com/fr/source/le-monde");
    expect(dynamicUrl("hashtags", "nl", "test")).toBe("https://www.lmn24.com/nl/hashtags/test");
  });
  it("serializes an index with one sitemap location per shard", () => {
    const xml = indexXml(["https://www.lmn24.com/sitemaps/static.xml"]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<loc>https://www.lmn24.com/sitemaps/static.xml</loc>");
  });
});
