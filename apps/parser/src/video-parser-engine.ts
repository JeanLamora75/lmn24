import type { DatabaseClient } from "@lmn24/database";
import { parseYouTubeAtom } from "./youtube-atom.js";

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15000;

function validateFeedUrl(value: string, channelId: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.youtube.com" ||
      url.pathname !== "/feeds/videos.xml" || url.searchParams.get("channel_id") !== channelId ||
      [...url.searchParams.keys()].some(x => x !== "channel_id"))
    throw new Error("URL Atom YouTube non autorisée.");
}
async function boundedResponse(response: Response): Promise<string> {
  if (!response.ok) throw new Error("HTTP " + response.status);
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_BYTES) throw new Error("Flux YouTube trop volumineux.");
  if (!response.body) throw new Error("Réponse YouTube vide.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Flux YouTube trop volumineux.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(buffer);
}

export class VideoParserEngine {
  constructor(private readonly database: DatabaseClient) {}

  async run(feedId?: string): Promise<{ feeds: number; successful: number; failed: number; imported: number; skipped: number }> {
    const feeds = await this.database.feedVideo.findMany({
      where: { isActive: true, ...(feedId ? { id: feedId } : {}) },
      orderBy: { id: "asc" },
      select: { id: true, sourceId: true, categoryId: true, languageIsoCode2: true, channelId: true, feedUrl: true },
    });
    const result = { feeds: feeds.length, successful: 0, failed: 0, imported: 0, skipped: 0 };
    for (const feed of feeds) {
      const startedAt = new Date();
      const run = await this.database.feedVideoRun.create({ data: { feedVideoId: feed.id, startedAt, status: "RUNNING" }, select: { id: true } });
      let error: string | null = null;
      let itemsFound = 0, videosImported = 0, videosSkipped = 0;
      try {
        validateFeedUrl(feed.feedUrl, feed.channelId);
        const response = await fetch(feed.feedUrl, {
          redirect: "manual",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { accept: "application/atom+xml, application/xml;q=0.9", "user-agent": "LMN24 Video Parser" },
        });
        const xml = await boundedResponse(response);
        const parsed = await parseYouTubeAtom(xml, feed.channelId);
        itemsFound = parsed.itemsFound;
        const unique = new Map(parsed.videos.map(video => [video.platformVideoId, video]));
        for (const video of unique.values()) {
          const created = await this.database.video.createMany({
            data: [{
              sourceId: feed.sourceId, feedVideoId: feed.id, categoryId: feed.categoryId,
              languageIsoCode2: feed.languageIsoCode2.trim().toLowerCase(), platform: "YOUTUBE",
              ...video,
            }],
            skipDuplicates: true,
          });
          videosImported += created.count;
        }
        videosSkipped = Math.max(0, itemsFound - videosImported);
        result.successful++;
        result.imported += videosImported;
        result.skipped += videosSkipped;
      } catch (caught) {
        error = caught instanceof Error ? caught.message.slice(0, 2000) : "Erreur inconnue.";
        result.failed++;
      }
      const finishedAt = new Date();
      const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      const status = error ? "ERROR" : "SUCCESS";
      await this.database.$transaction([
        this.database.feedVideo.update({ where: { id: feed.id },
          data: { lastFetchedAt: finishedAt, lastFetchDurationMs: durationMs, lastFetchStatus: status, lastError: error } }),
        this.database.feedVideoRun.update({ where: { id: run.id },
          data: { finishedAt, durationMs, status, itemsFound, videosImported, videosSkipped, errorMessage: error } }),
      ]);
    }
    return result;
  }
}
