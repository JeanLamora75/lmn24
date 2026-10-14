import type { DatabaseClient } from "@lmn24/database";
import type { ParserEvent, ParserFilters } from "./parser-engine.js";

export type RunType = "INFOS" | "VIDEOS";
export type Trigger = "MANUAL" | "AUTOMATIC";

const secretPattern = /((?:token|password|passwd|secret|api[_-]?key|authorization|access[_-]?key)=)[^&\s]+/gi;
const bearerPattern = /Bearer\s+\S+/gi;
const credentialUrl = /(https?:\/\/)[^@/\s]+@/gi;

/** Never store parser secrets or URLs with credentials in durable logs. */
export function safeLogText(value: string): string {
  return value.replace(secretPattern, "$1[REDACTED]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(credentialUrl, "$1[REDACTED]@").slice(0, 1024);
}

export class PersistentRunLog {
  constructor(private readonly db: DatabaseClient, private readonly parserType: RunType) {}

  async start(id: string, filters: ParserFilters, trigger: Trigger): Promise<void> {
    // Only permitted filter keys can be persisted; never persist arbitrary request body.
    const saved = {
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.countryIsoCode2 ? { countryIsoCode2: filters.countryIsoCode2 } : {}),
      ...(filters.languageIsoCode2 ? { languageIsoCode2: filters.languageIsoCode2 } : {}),
      ...("feedId" in filters && typeof filters.feedId === "string"
        ? { feedId: filters.feedId } : {}),
    };
    await this.db.parserBatchRun.create({
      data: { id, parserType: this.parserType, trigger, filters: saved, status: "RUNNING" },
    });
  }

  async event(id: string, e: ParserEvent): Promise<void> {
    const level = e.type === "run-error" || e.type === "feed-error" ? "ERROR" : "INFO";
    // Keep at most one compact event for each meaningful transition.
    await this.db.$transaction([
      this.db.parserRunEvent.create({
        data: {
          batchRunId: id,
          timestamp: new Date(e.timestamp),
          level, eventType: e.type, message: safeLogText(e.message),
        },
      }),
      this.db.parserBatchRun.update({
        where: { id }, data: {
          lastHeartbeatAt: new Date(),
          ...(e.type === "run-started" && typeof e.feedTotal === "number" && Number.isInteger(e.feedTotal)
            ? { totalFeeds: e.feedTotal } : {}),
        },
      }),
    ]);
  }

  async finish(id: string, failed: boolean): Promise<void> {
    const runRows = this.parserType === "INFOS"
      ? await this.db.feedRun.findMany({
        where: { batchRunId: id },
        select: { status: true, itemsFound: true, articlesImported: true, articlesSkipped: true },
      })
      : await this.db.feedVideoRun.findMany({
        where: { batchRunId: id },
        select: { status: true, itemsFound: true, videosImported: true, videosSkipped: true },
      });
    const successful = runRows.filter((r) => r.status === "SUCCESS").length;
    const errors = runRows.filter((r) => r.status === "ERROR").length;
    const imported = runRows.reduce((n, r) => n +
      ("articlesImported" in r ? r.articlesImported : r.videosImported), 0);
    const skipped = runRows.reduce((n, r) => n +
      ("articlesSkipped" in r ? r.articlesSkipped : r.videosSkipped), 0);
    const finalStatus = failed || errors > 0 ? "ERROR" : "SUCCESS";
    await this.db.parserBatchRun.update({
      where: { id }, data: {
        finishedAt: new Date(), lastHeartbeatAt: new Date(),
        status: finalStatus, processedFeeds: runRows.length,
        successfulFeeds: successful, failedFeeds: errors,
        itemsFound: runRows.reduce((n, r) => n + r.itemsFound, 0),
        itemsImported: imported, itemsSkipped: skipped,
      },
    });
  }

  /** Runs with no heartbeat for 15 minutes can no longer be declared successful.
   * Use a conservative cutoff: active long-running downloads may emit fewer events.
   */
  async recoverInterrupted(): Promise<number> {
    const result = await this.db.parserBatchRun.updateMany({
      where: {
        parserType: this.parserType, status: "RUNNING",
        lastHeartbeatAt: { lt: new Date(Date.now() - 15 * 60_000) },
      },
      data: { status: "INTERRUPTED", finishedAt: new Date() },
    });
    return result.count;
  }
}
