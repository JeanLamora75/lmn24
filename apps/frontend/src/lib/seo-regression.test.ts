import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../app/robots";
import { GET as getIndex } from "../app/sitemap.xml/route";
import { GET as getStatic } from "../app/sitemaps/static.xml/route";
import { GET as getShard } from "../app/sitemaps/[kind]/[locale]/[page]/route";
import { SEO_LANGUAGES, seoAlternates, SEO_SITE, type SeoLocale } from "./seo-metadata";
import { SEO_COPY, seoSocial } from "./seo-social";
import { collectionSchema, serializeJsonLd, siteSchema } from "./seo-schema";

const KINDS = ["categories", "sources", "hashtags"] as const;
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BACKEND_INTERNAL_URL;
});

function graph(data: Record<string, unknown>): Array<Record<string, unknown>> {
  return data["@graph"] as Array<Record<string, unknown>>;
}

function responseJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json" },
  });
}
function allCounts(overrides: Record<string, number> = {}) {
  return {
    pageSize: 1000,
    results: KINDS.flatMap(kind => SEO_LANGUAGES.map(locale =>
      ({ kind, locale, count: overrides[kind + "/" + locale] ?? 0 }))),
  };
}
function shard(kind: string, locale: string, page: string) {
  return getShard(new Request(SEO_SITE + "/sitemaps/" + kind + "/" + locale + "/" + page), {
    params: Promise.resolve({kind, locale, page}),
  });
}

describe("SCRUM-100 real SEO route contracts (no production network)", () => {
  it("serves 8-language static sitemap URLs, all canonical, safe and unique", async () => {
    const r = getStatic();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/xml");
    const xml = await r.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]!);
    expect(urls.length).toBe(SEO_LANGUAGES.length * 17);
    expect(new Set(urls).size).toBe(urls.length);
    for (const locale of SEO_LANGUAGES) {
      for (const section of ["", "/weather", "/videos", "/hashtags", "/horoscope"]) {
        const url = SEO_SITE + "/" + locale + section;
        expect(urls, url).toContain(url);
        expect(seoAlternates(locale, section.replace(/^\//, "")).canonical).toBe(url);
      }
    }
    expect(urls.every(url => url.startsWith(SEO_SITE + "/"))).toBe(true);
    expect(urls.some(url => /\/(admin|api)(\/|$)/.test(url))).toBe(false);
  });

  it("returns a complete sharded index without private categories or invented pages", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://localhost:3001";
    const fetchStub = vi.fn(async () => responseJson(allCounts({
      "categories/fr": 1001, "sources/en": 1, "hashtags/ru": 1,
    })));
    vi.stubGlobal("fetch", fetchStub);
    const response = await getIndex();
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain(SEO_SITE + "/sitemaps/categories/fr/0");
    expect(xml).toContain(SEO_SITE + "/sitemaps/categories/fr/1");
    expect(xml).toContain(SEO_SITE + "/sitemaps/sources/en/0");
    expect(xml).toContain(SEO_SITE + "/sitemaps/hashtags/ru/0");
    expect(xml).not.toContain("/sitemaps/categories/fr/2");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/api/");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("reliably rejects invalid and unavailable dynamic sitemap shards", async () => {
    expect((await shard("admin", "fr", "0")).status).toBe(404);
    expect((await shard("sources", "xx", "0")).status).toBe(404);
    expect((await shard("sources", "fr", "-1")).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => responseJson({message:"Unavailable"}, 503)));
    expect((await shard("sources", "fr", "0")).status).toBe(503);
    expect((await getIndex()).status).toBe(503);
  });

  it("keeps active public slugs and never emits private, malformed or untrusted URLs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responseJson({
      kind: "sources", locale: "fr", page: 0,
      items: [
        {slug:"source-active",lastModified:"2026-11-14T00:00:00Z"},
        {slug:"../admin",lastModified:"2026-11-14T00:00:00Z"},
        {slug:"INACTIVE",lastModified:"2026-11-14T00:00:00Z"},
      ],
    })));
    const result = await shard("sources", "fr", "0");
    const xml = await result.text();
    expect(result.status).toBe(200);
    expect(xml).toContain(SEO_SITE + "/fr/source/source-active");
    expect(xml).not.toContain("../admin");
    expect(xml).not.toContain("INACTIVE");
  });
});

describe("SCRUM-100 metadata and structured data in every public language", () => {
  it.each([...SEO_LANGUAGES])("uses canonical and reciprocal hreflang for %s", (locale) => {
    for (const section of ["", "videos", "hashtags", "weather", "horoscope"]) {
      const alternates = seoAlternates(locale, section);
      expect(alternates.canonical).toBe(SEO_SITE + "/" + locale +
        (section ? "/" + section : ""));
      for (const variant of SEO_LANGUAGES) {
        const url = SEO_SITE + "/" + variant + (section ? "/" + section : "");
        expect(alternates.languages?.[variant]).toBe(url);
        expect(seoAlternates(variant, section).languages?.[locale]).toBe(alternates.canonical);
      }
      expect(alternates.languages?.["x-default"]).toBeUndefined();
    }
  });

  it.each([...SEO_LANGUAGES])("generates non-empty localized titles, descriptions and social data for %s", (locale) => {
    const copy = SEO_COPY[locale];
    const url = SEO_SITE + "/" + locale + "/videos";
    const result = seoSocial(locale, copy.videoTitle, copy.videoDescription, url);
    expect(copy.homeTitle.trim().length).toBeGreaterThan(4);
    expect(copy.videoDescription.trim().length).toBeGreaterThan(10);
    expect(result.openGraph?.url).toBe(url);
    expect(result.openGraph?.description).toBe(copy.videoDescription);
    expect(result.twitter).toMatchObject({title:copy.videoTitle,description:copy.videoDescription});
  });

  it.each([...SEO_LANGUAGES])("emits parseable, injection-safe site and collection JSON-LD for %s", (locale) => {
    const home = SEO_SITE + "/" + locale;
    for (const data of [
      siteSchema(locale),
      collectionSchema({locale,url:home,name:SEO_COPY[locale].homeTitle}),
    ]) {
      const raw = serializeJsonLd(data);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["@context"]).toBe("https://schema.org");
      expect(graph(parsed).length).toBeGreaterThan(0);
      expect(raw).not.toContain("</script>");
    }
    const hostile = serializeJsonLd(collectionSchema({
      locale, url: home, name: "</script><script>alert(1)</script>",
    }));
    expect(hostile).not.toContain("<script>");
    expect(graph(JSON.parse(hostile) as Record<string, unknown>)[0]?.name)
      .toBe("</script><script>alert(1)</script>");
  });

  it("never advertises nonexistent source/category language equivalents", () => {
    const available: SeoLocale[] = ["fr", "en"];
    for (const language of available) {
      const meta = seoAlternates(language, "source", "example", available);
      expect(Object.keys(meta.languages ?? {})).toEqual(available);
      expect(meta.languages?.de).toBeUndefined();
    }
  });

  it("keeps robots crawl exclusions explicit but exposes the sitemap", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    expect(rules.some(rule => rule.userAgent === "*" && rule.allow === "/" &&
      Array.isArray(rule.disallow) && rule.disallow.includes("/admin") &&
      rule.disallow.includes("/api/"))).toBe(true);
    expect(config.sitemap).toBe(SEO_SITE + "/sitemap.xml");
    expect(config.host).toBe(SEO_SITE);
  });
});
