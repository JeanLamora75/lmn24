import { serializeJsonLd, type JsonLdNode } from "@/lib/seo-schema";

export function StructuredData({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
  />;
}
