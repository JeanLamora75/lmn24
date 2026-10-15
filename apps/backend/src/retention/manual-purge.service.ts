import {
  BadRequestException, ConflictException, Injectable, Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { rebuildHashtagHourlyCounts, type DatabaseClient } from "@lmn24/database";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "../hashtags/hashtag-trends.service";
import { RetentionSettingsService } from "./retention-settings.service";

export const PURGE_TABLES = [
  "article", "video", "feed_run", "feed_video_run", "hashtag_hourly_count", "horoscope",
] as const;
export type PurgeTable = typeof PURGE_TABLES[number];
export type PurgeMode = "expired" | "all";
type JobState = "PENDING" | "RUNNING" | "COMPLETED" | "ERROR";
const BATCH = 400;
const MINUTE = 60_000;
const DAY = 86_400_000;

const RULES = {
  article: { retention: "retentionArticlesDays", field: "published_at" },
  horoscope: { retention: "retentionHoroscopesDays", field: "date" },
  video: { retention: "retentionVideosDays", field: "published_at" },
  feed_run: { retention: "retentionInfoParserRunsDays", field: "started_at" },
  feed_video_run: { retention: "retentionVideoParserRunsDays", field: "started_at" },
  hashtag_hourly_count: { retention: "retentionHashtagHourlyCountsDays", field: "hour_utc" },
} as const;

type Preview = {
  token: string;
  ownerId: string;
  table: PurgeTable;
  mode: PurgeMode;
  count: number;
  cutoff: Date | null;
  createdAt: number;
};
export type PurgeJob = {
  id: string;
  table: PurgeTable;
  mode: PurgeMode;
  status: JobState;
  startedAt: string;
  finishedAt: string | null;
  requestedBy: string;
  previewCount: number;
  deleted: number;
  durationMs: number | null;
  message: string | null;
};

export function isPurgeTable(input: string): input is PurgeTable {
  return (PURGE_TABLES as readonly string[]).includes(input);
}

@Injectable()
export class ManualPurgeService {
  private readonly logger = new Logger(ManualPurgeService.name);
  private readonly previews = new Map<string, Preview>();
  private readonly jobs: PurgeJob[] = [];
  private active = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly retention: RetentionSettingsService,
    private readonly trends: HashtagTrendsService,
  ) {}

  private async cutoffFor(table: PurgeTable, mode: PurgeMode, now = new Date()): Promise<Date | null> {
    if (mode === "all") return null;
    const { values } = await this.retention.getAll();
    if (table === "horoscope") {
      // Date-only records: expiration is based on the Paris civil day, not UTC instants.
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(now);
      const component = (type: string) => parts.find(part => part.type === type)?.value;
      const today = new Date(`${component("year")}-${component("month")}-${component("day")}T00:00:00.000Z`);
      return new Date(today.getTime() - values.retentionHoroscopesDays * DAY);
    }
    return new Date(now.getTime() - values[RULES[table].retention] * DAY);
  }

  private publishedFilter(cutoff: Date | null) {
    return cutoff ? { publishedAt: { lt: cutoff } } : {};
  }
  private runFilter(cutoff: Date | null) {
    return { status: { not: "RUNNING" }, ...(cutoff ? { startedAt: { lt: cutoff } } : {}) };
  }
  private horoscopeFilter(cutoff: Date | null) {
    return cutoff ? { date: { lt: cutoff } } : {};
  }
  private hourFilter(cutoff: Date | null) {
    return cutoff ? { hourUtc: { lt: cutoff } } : {};
  }

  private async count(
    table: PurgeTable, cutoff: Date | null,
    db: Pick<DatabaseClient, "article" | "video" | "feedRun" | "feedVideoRun" | "hashtagHourlyCount" | "horoscope"> = this.db.prisma,
  ): Promise<number> {
    switch (table) {
      case "horoscope": return db.horoscope.count({ where: this.horoscopeFilter(cutoff) });
      case "article": return db.article.count({ where: this.publishedFilter(cutoff) });
      case "video": return db.video.count({ where: this.publishedFilter(cutoff) });
      case "feed_run": return db.feedRun.count({ where: this.runFilter(cutoff) });
      case "feed_video_run": return db.feedVideoRun.count({ where: this.runFilter(cutoff) });
      case "hashtag_hourly_count": return db.hashtagHourlyCount.count({
        where: this.hourFilter(cutoff),
      });
    }
  }

  async preview(ownerId: string, table: PurgeTable, mode: PurgeMode) {
    if (this.active) throw new ConflictException("Une purge est déjà en cours.");
    // Evict expired confirmations; a GET never deletes DB rows.
    for (const [key, item] of this.previews) {
      if (Date.now() - item.createdAt > 3 * MINUTE) this.previews.delete(key);
    }
    const cutoff = await this.cutoffFor(table, mode);
    const count = await this.count(table, cutoff);
    const token = randomUUID();
    this.previews.set(token, {
      token, ownerId, table, mode, count, cutoff, createdAt: Date.now(),
    });
    return {
      token, table, mode, count, cutoff: cutoff?.toISOString() ?? null,
      expiresAt: new Date(Date.now() + 3 * MINUTE).toISOString(),
      warnings: table === "article"
        ? ["Les compteurs hashtags seront invalidés puis intégralement reconstruits."]
        : table === "hashtag_hourly_count"
          ? ["Les classements seront marqués non vérifiés jusqu'à reconstruction."]
          : table === "horoscope"
            ? ["Les fichiers JSON et les journaux d’import restent intacts. Les métadonnées astronomiques devenues orphelines seront nettoyées."]
            : [],
    };
  }

  recentJobs(): PurgeJob[] {
    return this.jobs.slice(0, 10).map((job) => ({ ...job }));
  }

  start(ownerId: string, input: {
    token: string; table: PurgeTable; mode: PurgeMode;
    confirmed: boolean; typedName?: string | undefined;
  }): PurgeJob {
    if (this.active) throw new ConflictException("Une purge est déjà en cours.");
    const preview = this.previews.get(input.token);
    if (!preview || Date.now() - preview.createdAt > 3 * MINUTE ||
        preview.ownerId !== ownerId || preview.table !== input.table ||
        preview.mode !== input.mode) {
      throw new BadRequestException("Prévisualisation expirée ou invalide. Actualisez-la.");
    }
    if (!input.confirmed || input.mode === "all" && input.typedName !== input.table) {
      throw new BadRequestException("Confirmation de purge manquante ou incorrecte.");
    }
    this.previews.delete(input.token); // one-time anti-CSRF confirmation
    const job: PurgeJob = {
      id: randomUUID(), table: input.table, mode: input.mode, status: "PENDING",
      startedAt: new Date().toISOString(), finishedAt: null, requestedBy: ownerId,
      previewCount: preview.count, deleted: 0, durationMs: null, message: null,
    };
    this.active = true;
    this.jobs.unshift(job);
    if (this.jobs.length > 30) this.jobs.length = 30;
    void this.execute(job, preview);
    return { ...job };
  }

  private async execute(job: PurgeJob, preview: Preview): Promise<void> {
    job.status = "RUNNING";
    const began = Date.now();
    this.logger.warn("Manual purge started: " + JSON.stringify({
      jobId: job.id, table: job.table, mode: job.mode, owner: job.requestedBy,
      candidates: job.previewCount,
    }));
    try {
      // One transaction: either all selected rows disappear or none do.
      // pg advisory locks serialize this purge with other purge instances,
      // and article writes/hashtag rebuilds use the shared 52024/52 lock.
      job.deleted = await this.db.prisma.$transaction(async (tx) => {
        const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`
          SELECT pg_try_advisory_xact_lock(52024, 58) AS acquired
        `;
        if (!lock[0]?.acquired) throw new ConflictException("Une autre purge est en cours.");
        if (job.table === "article" || job.table === "hashtag_hourly_count") {
          await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(52024, 52)`;
        }
        const refreshed = await this.cutoffFor(job.table, job.mode);
        if (refreshed?.getTime() !== preview.cutoff?.getTime() && job.mode === "expired") {
          // Retention may change during preview; use the original cutoff after
          // verifying that the configured policy has not changed.
          const { values } = await this.retention.getAll();
          const configured = values[RULES[job.table].retention];
          const snapshot = Math.round((preview.createdAt - preview.cutoff!.getTime()) / DAY);
          if (configured !== snapshot) throw new ConflictException("Durée modifiée. Reprévisualisez.");
        }
        const cutoff = preview.cutoff;
        const before = await this.count(job.table, cutoff, tx);
        if (before !== preview.count) {
          throw new ConflictException("Le nombre d'enregistrements a changé. Reprévisualisez.");
        }
        let deleted = 0;
        if (job.table === "article" && before > 0) {
          // Clear BEFORE the article deletion in the SAME commit. Readers
          // never see counters pointing to purged articles. An async rebuild
          // restores consistent aggregates after the purge has committed.
          await tx.hashtagHourlyCount.deleteMany({});
          await tx.setting.deleteMany({ where: { scope: "GLOBAL",
            key: { in: ["hashtagStatsLastFullRebuildAt", "hashtagStatsCoverageSinceUtc"] } } });
        }
        if (job.table === "hashtag_hourly_count" && before > 0) {
          await tx.setting.deleteMany({ where: { scope: "GLOBAL",
            key: { in: ["hashtagStatsLastFullRebuildAt", "hashtagStatsCoverageSinceUtc"] } } });
        }
        while (true) {
          let n = 0;
          switch (job.table) {
            case "article": {
              const rows = await tx.article.findMany({ where: this.publishedFilter(cutoff),
                take: BATCH, select: { id: true } });
              if (!rows.length) break;
              n = (await tx.article.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })).count;
              break;
            }
            case "horoscope": {
              const rows = await tx.horoscope.findMany({ where: this.horoscopeFilter(cutoff),
                take: BATCH, select: { id: true } });
              if (!rows.length) break;
              n = (await tx.horoscope.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })).count;
              break;
            }
            case "video": {
              const rows = await tx.video.findMany({ where: this.publishedFilter(cutoff),
                take: BATCH, select: { id: true } });
              if (!rows.length) break;
              n = (await tx.video.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })).count;
              break;
            }
            case "feed_run": {
              const rows = await tx.feedRun.findMany({ where: this.runFilter(cutoff),
                take: BATCH, select: { id: true } });
              if (!rows.length) break;
              n = (await tx.feedRun.deleteMany({ where: { id: { in: rows.map(r => r.id) },
                status: { not: "RUNNING" } } })).count;
              break;
            }
            case "feed_video_run": {
              const rows = await tx.feedVideoRun.findMany({ where: this.runFilter(cutoff),
                take: BATCH, select: { id: true } });
              if (!rows.length) break;
              n = (await tx.feedVideoRun.deleteMany({ where: { id: { in: rows.map(r => r.id) },
                status: { not: "RUNNING" } } })).count;
              break;
            }
            case "hashtag_hourly_count": {
              const rows = await tx.hashtagHourlyCount.findMany({
                where: this.hourFilter(cutoff),
                take: BATCH, select: { hashtagId: true, hourUtc: true },
              });
              if (!rows.length) break;
              n = (await tx.hashtagHourlyCount.deleteMany({ where: { OR: rows.map(r => ({
                hashtagId: r.hashtagId, hourUtc: r.hourUtc,
              })) } })).count;
              break;
            }
          }
          if (!n) break;
          deleted += n;
        }
        if (job.table === "horoscope" && deleted > 0) {
          // Do not retain orphan snapshots; do not delete source files or import logs.
          await tx.horoscopeAstronomySnapshot.deleteMany({
            where: { horoscopes: { none: {} } },
          });
        }
        return deleted;
      }, { maxWait: 5_000, timeout: 15 * MINUTE });
      if (job.deleted > 0 &&
          (job.table === "article" || job.table === "hashtag_hourly_count")) {
        this.trends.invalidate();
      }
      if (job.table === "article" && job.deleted > 0) {
        // The purge itself is already COMMITTED. A failed recalculation
        // must not claim the committed deletion failed or leave stale scores.
        try {
          await rebuildHashtagHourlyCounts(this.db.prisma);
          this.trends.invalidate();
        } catch (error) {
          job.message = "Articles supprimés ; reconstruction hashtags à relancer : " +
            (error instanceof Error ? error.message : String(error));
          this.logger.warn(job.message);
        }
      }
      job.status = "COMPLETED";
    } catch (error) {
      job.status = "ERROR";
      job.message = error instanceof Error ? error.message : "Erreur de purge.";
      this.logger.error("Manual purge failed: " + JSON.stringify({
        id: job.id, table: job.table, message: job.message,
      }));
    } finally {
      job.finishedAt = new Date().toISOString();
      job.durationMs = Date.now() - began;
      this.active = false;
      this.logger.warn("Manual purge finished: " + JSON.stringify(job));
    }
  }
}
