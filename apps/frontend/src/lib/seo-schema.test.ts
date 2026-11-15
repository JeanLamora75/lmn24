import { describe, expect, it } from "vitest";
import { SEO_LANGUAGES } from "./seo-metadata";
import { collectionSchema, pageBreadcrumbs, serializeJsonLd, siteSchema } from "./seo-schema";

type Node = Record<string, unknown>;
function graph(schema: Node): Node[] { return schema["@graph"] as Node[]; }

describe("SCRUM-97 Schema.org JSON-LD", () => {
  it("outputs a single stable organization and localized WebSite in all eight languages", () => {
    const ids = new Set<string>();
    for (const locale of SEO_LANGUAGES) {
      const schema = siteSchema(locale);
      expect(schema["@context"]).toBe("https://schema.org");
      const nodes = graph(schema);
      expect(nodes.map(x => x["@type"])).toEqual(["Organization", "WebSite"]);
      expect(nodes[0]?.url).toBe("https://www.lmn24.com");
      expect((nodes[0]?.logo as Node).url).toBe("https://www.lmn24.com/logo_lmn24.png");
      expect(nodes[1]?.inLanguage).toBe(locale);
      expect((nodes[1]?.publisher as Node)["@id"]).toBe(nodes[0]?.["@id"]);
      ids.add(nodes[0]?.["@id"] as string);
    }
    expect(ids.size).toBe(1);
  });

  it("only emits accurate collection IDs and relative hierarchy as absolute canonical URLs", () => {
    const locale = "fr";
    const url = "https://www.lmn24.com/fr/hashtags/climat";
    const page = collectionSchema({ locale, url, name: "Climat",
      description: "Articles sur le climat",
      breadcrumbs: pageBreadcrumbs(locale, "Hashtags", "hashtags",
        { title: "Climat", slug: "climat" }) });
    const nodes = graph(page);
    expect(nodes.map(x => x["@type"])).toEqual(["CollectionPage", "BreadcrumbList"]);
    expect(nodes[0]?.["@id"]).toBe(url + "#collection");
    expect(nodes[0]?.url).toBe(url);
    expect(nodes[0]?.inLanguage).toBe(locale);
    const list = nodes[1]?.itemListElement as Node[];
    expect(list.map(x => x.position)).toEqual([1, 2, 3]);
    expect(list.map(x => x.item)).toEqual([
      "https://www.lmn24.com/fr", "https://www.lmn24.com/fr/hashtags", url,
    ]);
  });

  it("does not emit breadcrumb markup when the last crumb disagrees with the current URL", () => {
    const page = collectionSchema({
      locale: "en", url: "https://www.lmn24.com/en/source/example",
      name: "Example",
      breadcrumbs: [{name:"LMN24",url:"https://www.lmn24.com/en"},
        {name:"Wrong",url:"https://www.lmn24.com/en/source/other"}],
    });
    expect(graph(page).map(x => x["@type"])).toEqual(["CollectionPage"]);
  });

  it("prevents JSON-LD script injection while preserving real editorial text", () => {
    const malicious = "</script><script>alert('xss')</script> & \u2028";
    const raw = serializeJsonLd(collectionSchema({
      locale:"nl",url:"https://www.lmn24.com/nl/hashtags/nieuws",
      name:malicious,
    }));
    expect(raw).not.toContain("<");
    expect(raw).not.toContain(">");
    expect(raw).not.toContain("&");
    expect(raw).toContain("\\u003c");
    const decoded = JSON.parse(raw) as Node;
    expect(graph(decoded)[0]?.name).toBe(malicious);
    expect(raw).not.toContain('"@type":"NewsArticle"');
  });

  it("never claims syndicated stories are LMN24 NewsArticle or videos are eligible VideoObject", () => {
    const html = serializeJsonLd(siteSchema("fr")) +
      serializeJsonLd(collectionSchema({locale:"fr",
        url:"https://www.lmn24.com/fr/videos",name:"Vidéos"}));
    expect(html).not.toContain("NewsArticle");
    expect(html).not.toContain("VideoObject");
  });
});
