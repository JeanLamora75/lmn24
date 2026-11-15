import { describe, expect, it } from "vitest";
import { seoAlternates, seoPath, SEO_LANGUAGES, SEO_SITE } from "./seo-metadata";

describe("SCRUM-95 canonical and multilingual hreflang", () => {
  it("publishes exactly one absolute canonical on the HTTPS www host", () => {
    for (const locale of SEO_LANGUAGES) {
      const a = seoAlternates(locale, "weather");
      expect(a.canonical).toBe(SEO_SITE + "/" + locale + "/weather");
      expect(a.canonical).not.toContain("?");
      expect(a.canonical).not.toContain("///");
    }
  });
  it("makes all eight language alternates reciprocal on equivalent public routes", () => {
    for (const locale of SEO_LANGUAGES) {
      const a = seoAlternates(locale, "horoscope", "aries");
      expect(Object.keys(a.languages ?? {})).toEqual([...SEO_LANGUAGES]);
      expect(a.languages?.fr).toBe(SEO_SITE + "/fr/horoscope/aries");
      expect(a.languages?.nl).toBe(SEO_SITE + "/nl/horoscope/aries");
      expect(a.languages?.[locale]).toBe(a.canonical);
      expect(a.languages?.["x-default"]).toBeUndefined();
    }
  });
  it("does not advertise empty or unavailable category/source translations", () => {
    const locales = ["fr", "en"] as const;
    const fr = seoAlternates("fr", "category", "international", locales);
    const en = seoAlternates("en", "category", "international", locales);
    expect(fr.languages).toEqual(en.languages);
    expect(fr.languages?.de).toBeUndefined();
    expect(fr.canonical).toBe(SEO_SITE + "/fr/category/international");
  });
  it("properly encodes dynamic slugs and preserves canonical routing", () => {
    expect(seoPath("en", "source", "the-guardian"))
      .toBe("/en/source/the-guardian");
    expect(seoAlternates("pt").canonical).toBe(SEO_SITE + "/pt");
  });
});
