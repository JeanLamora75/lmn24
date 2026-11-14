import { describe, expect, it } from "vitest";
import { cleanSeoText, SEO_BRAND_IMAGE, SEO_COPY, seoSocial } from "./seo-social";
import { SEO_LANGUAGES, SEO_SITE, seoAlternates } from "./seo-metadata";

describe("SCRUM-96 localized and safe social metadata", () => {
  it("has meaningful distinct copy for all eight public languages", () => {
    expect(Object.keys(SEO_COPY)).toEqual([...SEO_LANGUAGES]);
    for (const locale of SEO_LANGUAGES) {
      const copy = SEO_COPY[locale];
      expect(copy.homeTitle.trim().length).toBeGreaterThan(4);
      expect(copy.videoTitle.trim().length).toBeGreaterThan(4);
      expect(copy.videoDescription.trim().length).toBeGreaterThan(20);
      expect(copy.sourceDescription("BBC")).toContain("BBC");
      expect(copy.categoryDescription("International")).toContain("International");
      expect(copy.hashtagDescription("Climate")).toContain("Climate");
    }
    expect(new Set(SEO_LANGUAGES.map(l => SEO_COPY[l].videoDescription)).size).toBe(8);
    expect(new Set(SEO_LANGUAGES.map(l => SEO_COPY[l].homeTitle)).size).toBe(8);
  });
  it("builds canonical-aligned Open Graph and Twitter cards without third-party image links", () => {
    for (const locale of SEO_LANGUAGES) {
      const url = seoAlternates(locale, "source", "example").canonical as string;
      const social = seoSocial(locale, "Example | LMN24", "Public media details", url);
      expect(social.openGraph?.url).toBe(url);
      expect(social.openGraph?.title).toBe("Example | LMN24");
      expect(social.openGraph?.description).toBe("Public media details");
      expect(social.twitter).toMatchObject({ card: "summary" });
      expect(social.twitter?.images).toEqual([SEO_BRAND_IMAGE]);
      expect((social.openGraph?.images as Array<{url:string}>)[0]?.url).toBe(SEO_SITE + "/logo_lmn24.png");
    }
  });
  it("strips controls, limits text and never invents descriptions", () => {
    expect(cleanSeoText("  A\n\tB  ")).toBe("A B");
    expect(cleanSeoText("")).toBeNull();
    expect(cleanSeoText(null)).toBeNull();
    expect(cleanSeoText("A".repeat(300))?.length).toBe(155);
  });
  it("omits images for a page with no authorized preview", () => {
    const result = seoSocial("fr", "Titre", "Description", SEO_SITE + "/fr", null);
    expect(result.openGraph?.images).toBeUndefined();
    expect(result.twitter?.images).toBeUndefined();
  });
});
