import Parser from "rss-parser";

export type ParsedArticle = {
  title: string;
  summary: string | null;
  imageUrl: string;
  articleUrl: string;
  publishedAt: Date;
};

const parser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
      ["summary", "summary"],
      ["published", "published"],
      ["updated", "updated"],
      ["dc:date", "dcDate"],
    ],
  },
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return named[entity.toLowerCase()] ?? match;
    },
  );
}

export function cleanHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHttpUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value.trim(), baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function findHttpUrlInValue(
  value: unknown,
  baseUrl: string,
  depth = 0,
): string | null {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const direct = normalizeHttpUrl(value, baseUrl);

    if (direct) {
      return direct;
    }

    const match = value.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? normalizeHttpUrl(match[0], baseUrl) : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHttpUrlInValue(item, baseUrl, depth + 1);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const preferredKeys = ["url", "href", "src"];

  for (const key of preferredKeys) {
    const found = findHttpUrlInValue(record[key], baseUrl, depth + 1);

    if (found) {
      return found;
    }
  }

  for (const nested of Object.values(record)) {
    const found = findHttpUrlInValue(nested, baseUrl, depth + 1);

    if (found) {
      return found;
    }
  }

  return null;
}

function extractImageFromHtml(value: string, baseUrl: string): string | null {
  const match = value.match(
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i,
  );

  return match?.[1] ? normalizeHttpUrl(match[1], baseUrl) : null;
}

function findImageUrl(
  item: Record<string, unknown>,
  baseUrl: string,
): string | null {
  const knownKeys = [
    "mediaContent",
    "mediaThumbnail",
    "enclosure",
    "image",
    "thumbnail",
  ] as const;

  for (const key of knownKeys) {
    const found = findHttpUrlInValue(item[key], baseUrl);

    if (found) {
      return found;
    }
  }

  for (const [key, value] of Object.entries(item)) {
    if (/image|media|thumbnail|enclosure/i.test(key)) {
      const found = findHttpUrlInValue(value, baseUrl);

      if (found) {
        return found;
      }
    }
  }

  for (const key of [
    "contentEncoded",
    "content",
    "summary",
    "description",
  ]) {
    const value = item[key];

    if (typeof value === "string") {
      const found = extractImageFromHtml(value, baseUrl);

      if (found) {
        return found;
      }
    }
  }

  for (const value of Object.values(item)) {
    if (typeof value === "string" && /<img\b/i.test(value)) {
      const found = extractImageFromHtml(value, baseUrl);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findArticleUrl(
  item: Record<string, unknown>,
  baseUrl: string,
): string | null {
  const direct = getString(item, ["link"]);

  if (direct) {
    const normalized = normalizeHttpUrl(direct, baseUrl);

    if (normalized) {
      return normalized;
    }
  }

  for (const [key, value] of Object.entries(item)) {
    if (/^link$|article.?url|permalink|guid/i.test(key)) {
      const found = findHttpUrlInValue(value, baseUrl);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findPublishedAt(item: Record<string, unknown>): Date | null {
  const candidates = [
    getString(item, ["isoDate"]),
    getString(item, ["pubDate", "published"]),
    getString(item, ["updated", "dcDate"]),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const timestamp = Date.parse(candidate);

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }

  return null;
}

function findSummary(item: Record<string, unknown>): string | null {
  const raw = getString(item, [
    "summary",
    "description",
    "contentEncoded",
    "content",
    "contentSnippet",
  ]);

  if (!raw) {
    return null;
  }

  const cleaned = cleanHtml(raw);
  return cleaned || null;
}

export async function parseFeedXml(
  xml: string,
  baseUrl: string,
): Promise<{ itemsFound: number; articles: ParsedArticle[] }> {
  const output = await parser.parseString(xml);
  const items = (output.items ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const articles: ParsedArticle[] = [];

  for (const item of items) {
    const rawTitle = getString(item, ["title"]);
    const title = rawTitle ? cleanHtml(rawTitle) : "";
    const articleUrl = findArticleUrl(item, baseUrl);
    const publishedAt = findPublishedAt(item);
    const imageUrl = findImageUrl(item, articleUrl ?? baseUrl);

    if (!title || !articleUrl || !publishedAt || !imageUrl) {
      continue;
    }

    articles.push({
      title,
      summary: findSummary(item),
      imageUrl,
      articleUrl,
      publishedAt,
    });
  }

  return {
    itemsFound: items.length,
    articles,
  };
}
