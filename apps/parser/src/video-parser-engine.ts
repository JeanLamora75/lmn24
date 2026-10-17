import type { DatabaseClient } from "@lmn24/database";
import type { ParserEvent, ParserFilters } from "./parser-engine.js";

export type VideoParserFilters = ParserFilters & { feedId?: string | undefined };
type VideoSummary = { feeds: number; successful: number; failed: number; imported: number; skipped: number };
type VideoEmitter = (event: ParserEvent) => void;
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

  async run(filters: VideoParserFilters = {}, emit?: VideoEmitter, batchRunId?: string, signal?: AbortSignal): Promise<VideoSummary> {
    const assertLease=()=>{ if(signal?.aborted) throw new Error('Video parser global lease lost'); };
    const feeds = await this.database.feedVideo.findMany({
      where: {
        isActive: true,
        ...(filters.feedId ? { id: filters.feedId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.languageIsoCode2 ? { languageIsoCode2: filters.languageIsoCode2.trim().toLowerCase() } : {}),
        ...(filters.countryIsoCode2 ? {
          source: { country: { isoCode2: filters.countryIsoCode2.trim().toUpperCase() } },
        } : {}),
      },
      orderBy: [{ source: { name: "asc" } }, { feedUrl: "asc" }, { id: "asc" }],
      select: { id: true, sourceId: true, categoryId: true, languageIsoCode2: true, channelId: true, feedUrl: true },
    });
    const result: VideoSummary = { feeds: feeds.length, successful: 0, failed: 0, imported: 0, skipped: 0 };
    emit?.({
      type: "run-started",
      timestamp: new Date().toISOString(),
      message: "Extraction vidéo démarrée — " + feeds.length + " flux à traiter.",
      feedTotal: feeds.length,
    });
    for (const [index, feed] of feeds.entries()) {
      assertLease();
      emit?.({
        type: "feed-started",
        timestamp: new Date().toISOString(),
        message: "Traitement " + (index + 1) + "/" + feeds.length + " — " + feed.feedUrl,
        feedIndex: index + 1,
        feedTotal: feeds.length,
        feedUrl: feed.feedUrl,
      });
      const startedAt = new Date();
      const run = await this.database.feedVideoRun.create({ data: { feedVideoId: feed.id, ...(batchRunId ? { batchRunId } : {}), startedAt, status: "RUNNING" }, select: { id: true } });
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
          assertLease();
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
        assertLease();
        error = caught instanceof Error ? caught.message.slice(0, 2000) : "Erreur inconnue.";
        result.failed++;
      }
      const finishedAt = new Date();
      const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      const status = error ? "ERROR" : "SUCCESS";
      assertLease();
      await this.database.$transaction([
        this.database.feedVideo.update({ where: { id: feed.id },
          data: { lastFetchedAt: finishedAt, lastFetchDurationMs: durationMs, lastFetchStatus: status, lastError: error } }),
        this.database.feedVideoRun.update({ where: { id: run.id },
          data: { finishedAt, durationMs, status, itemsFound, videosImported, videosSkipped, errorMessage: error } }),
      ]);
      emit?.({
        type: error ? "feed-error" : "feed-success",
        timestamp: new Date().toISOString(),
        message: error
          ? "Échec — " + feed.feedUrl + " — " + error
          : "Succès — " + itemsFound + " vidéos détectées — " + videosImported +
            " ajoutées — " + videosSkipped + " ignorées",
        feedUrl: feed.feedUrl,
        feedIndex: index + 1,
        feedTotal: feeds.length,
        itemsFound,
      });
    }
    emit?.({
      type: "run-completed",
      timestamp: new Date().toISOString(),
      message: "Extraction vidéo terminée.\n\n" +
        result.feeds + " flux traités\n" +
        result.successful + " flux réussis\n" +
        result.failed + " flux en erreur\n" +
        result.imported + " nouvelles vidéos enregistrées\n" +
        result.skipped + " vidéos ignorées",
      feedTotal: result.feeds,
    });
    return result;
  }
}
