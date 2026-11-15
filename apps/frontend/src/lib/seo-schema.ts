import { SEO_SITE, type SeoLocale } from "./seo-metadata";
import { SEO_BRAND_IMAGE } from "./seo-social";

/** LMN24 publishes index/collection pages; syndicated stories remain publisher-owned. */
export type JsonLdNode = Record<string, unknown>;
const PUBLISHER_ID = SEO_SITE + "/#organization";
const WEBSITE_ID = SEO_SITE + "/#website";

export function serializeJsonLd(node: JsonLdNode | JsonLdNode[]): string {
  // JSON.stringify on trusted authored keys plus explicit escaping of HTML
  // delimiters prevents script-tag breakout from editorial names/descriptions.
  return JSON.stringify(node)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function siteSchema(locale: SeoLocale): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": PUBLISHER_ID,
        name: "LMN24",
        url: SEO_SITE,
        logo: {
          "@type": "ImageObject",
          url: SEO_BRAND_IMAGE,
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "LMN24",
        url: SEO_SITE,
        inLanguage: locale,
        publisher: { "@id": PUBLISHER_ID },
      },
    ],
  };
}

type BreadcrumbItem = { name: string; url: string };
type CollectionInput = {
  locale: SeoLocale;
  url: string;
  name: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
};

export function collectionSchema({
  locale, url, name, description, breadcrumbs,
}: CollectionInput): JsonLdNode {
  const collection: JsonLdNode = {
    "@type": "CollectionPage",
    "@id": url + "#collection",
    url,
    name,
    inLanguage: locale,
    isPartOf: { "@id": WEBSITE_ID },
    ...(description ? { description } : {}),
  };

  const validCrumbs = breadcrumbs?.filter(item => item.name.trim() && item.url.startsWith(SEO_SITE + "/")) ?? [];
  const graph: JsonLdNode[] = [collection];
  if (validCrumbs.length > 1 && validCrumbs.at(-1)?.url === url) {
    const breadcrumbId = url + "#breadcrumb";
    collection.breadcrumb = { "@id": breadcrumbId };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: validCrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function pageBreadcrumbs(locale: SeoLocale, sectionTitle: string, section: string,
  detail?: { title: string; slug: string }): BreadcrumbItem[] {
  const root = SEO_SITE + "/" + locale;
  const listing = root + "/" + section;
  return [
    { name: "LMN24", url: root },
    { name: sectionTitle, url: listing },
    ...(detail ? [{ name: detail.title, url: listing + "/" + encodeURIComponent(detail.slug) }] : []),
  ];
}
