import Parser from "rss-parser";
import { cleanHtml } from "./feed-parser.js";

export type ParsedVideo = {
  platformVideoId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string;
  publishedAt: Date;
  updatedOnPlatformAt: Date | null;
};

const parser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  customFields: { item: [
    ["yt:videoId", "youtubeVideoId"],
    ["yt:channelId", "youtubeChannelId"],
    ["media:group", "mediaGroup"],
    ["published", "published"],
    ["updated", "updated"],
  ] },
});

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function raw(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function safeUrl(value: unknown, hosts: readonly string[]): string | null {
  const input = raw(value);
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && hosts.includes(url.hostname) ? url.toString() : null;
  } catch { return null; }
}
function nestedText(value: unknown): string | null {
  if (typeof value === "string") return raw(value);
  const item = record(value);
  return item ? raw(item["#text"] ?? item["_"]) : null;
}
function mediaValue(group: Record<string, unknown> | null, name: string): unknown {
  const value = group?.[name];
  return Array.isArray(value) ? value[0] : value;
}
export async function parseYouTubeAtom(xml: string, expectedChannelId: string): Promise<{ itemsFound: number; videos: ParsedVideo[] }> {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(expectedChannelId)) throw new Error("Identifiant de chaîne YouTube invalide.");
  if (xml.length > 2_000_000) throw new Error("Flux YouTube trop volumineux.");
  // rss-parser handles the Atom namespaces and rejects malformed XML.
  const feed = await parser.parseString(xml);
  const rows = (feed.items ?? []) as Array<Record<string, unknown>>;
  const videos: ParsedVideo[] = [];
  for (const item of rows) {
    const videoId = raw(item.youtubeVideoId);
    const channelId = raw(item.youtubeChannelId);
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId) || channelId !== expectedChannelId) continue;
    const title = cleanHtml(raw(item.title) ?? "");
    const published = raw(item.published) ?? raw(item.isoDate) ?? raw(item.pubDate);
    if (!title || !published || Number.isNaN(Date.parse(published))) continue;
    const group = record(item.mediaGroup);
    const description = nestedText(mediaValue(group, "media:description"));
    const thumbnail = record(mediaValue(group, "media:thumbnail"));
    const thumbnailUrl = safeUrl(thumbnail?.url ?? record(thumbnail?.["$"])?.url,
      ["i.ytimg.com", "img.youtube.com", "i1.ytimg.com", "i2.ytimg.com", "i3.ytimg.com", "i4.ytimg.com"]);
    const updated = raw(item.updated);
    videos.push({
      platformVideoId: videoId,
      title,
      description: description ? cleanHtml(description) : null,
      thumbnailUrl,
      videoUrl: "https://www.youtube.com/watch?v=" + videoId,
      publishedAt: new Date(published),
      updatedOnPlatformAt: updated && !Number.isNaN(Date.parse(updated)) ? new Date(updated) : null,
    });
  }
  return { itemsFound: rows.length, videos };
}
