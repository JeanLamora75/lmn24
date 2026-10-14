import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lmn24/database";
import { DatabaseService } from "../database/database.service";

export type MonitoringQuery = {
  parser: "ALL" | "INFOS" | "VIDEOS";
  period: "24h" | "7d" | "30d" | "custom";
  from?: string | undefined; to?: string | undefined;
  status?: string | undefined; search?: string | undefined;
  countryId?: string | undefined; categoryId?: string | undefined;
  language?: string | undefined; page: number; pageSize: number;
};
const DAY = 86_400_000;
export function monitoringRange(query: MonitoringQuery, now = new Date()) {
  let from: Date, to: Date;
  if (query.period === "custom") {
    if (!query.from || !query.to) throw new BadRequestException("Dates manquantes.");
    from = new Date(query.from + "T00:00:00.000Z");
    to = new Date(new Date(query.to + "T00:00:00.000Z").getTime() + DAY);
  } else {
    to = now;
    from = new Date(now.getTime() -
      ({ "24h": 1, "7d": 7, "30d": 30 } as const)[query.period] * DAY);
  }
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())
    || to <= from || to.getTime() - from.getTime() > 91 * DAY
    || from.getTime() > now.getTime()) {
    throw new BadRequestException("Période invalide (maximum 90 jours).");
  }
  return { from, to };
}

export function safeCsvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r|\n/g, " ");
  // Spreadsheet injection: even when the cell is quoted, Excel evaluates = + - @.
  const neutral = /^[\s]*[=+\-@\t]/.test(text) ? "'" + text : text;
  return '"' + neutral.replace(/"/g, '""') + '"';
}
function safeError(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/(?:token|password|secret|api[_-]?key)=\S+/gi, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(https?:\/\/)[^@/\s]+@/gi, "$1[REDACTED]@")
    .slice(0, 2000);
}
type RunRow = {
  id: string; batchRunId: string | null; parserType: string;
  feedId: string; feedUrl: string; source: string;
  country: string; language: string; categoryId: string;
  startedAt: Date; finishedAt: Date | null; durationMs: number | null;
  status: string; itemsFound: number; imported: number; skipped: number;
  errorMessage: string | null;
};

@Injectable()
export class ParserMonitoringService {
  constructor(private readonly db: DatabaseService) {}

  private union(query: MonitoringQuery, from: Date, to: Date): Prisma.Sql {
    const types = query.parser === "ALL" ? ["INFOS","VIDEOS"] : [query.parser];
    return Prisma.join(types.map(type => {
      const info = type === "INFOS";
      const runTable = info ? Prisma.sql`"feed_run"` : Prisma.sql`"feed_video_run"`;
      const feedTable = info ? Prisma.sql`"feed"` : Prisma.sql`"feed_video"`;
      const foreign = info ? Prisma.sql`"feed_id"` : Prisma.sql`"feed_video_id"`;
      const imported = info ? Prisma.sql`r."articles_imported"` : Prisma.sql`r."videos_imported"`;
      const skipped = info ? Prisma.sql`r."articles_skipped"` : Prisma.sql`r."videos_skipped"`;
      const conditions: Prisma.Sql[] = [
        Prisma.sql`r."started_at" >= ${from} AND r."started_at" < ${to}`,
      ];
      if (query.status && query.status !== "ALL")
        conditions.push(Prisma.sql`r."status" = ${query.status}`);
      if (query.countryId) conditions.push(Prisma.sql`s."country_id" = ${query.countryId}::uuid`);
      if (query.categoryId) conditions.push(Prisma.sql`f."category_id" = ${query.categoryId}::uuid`);
      if (query.language) conditions.push(Prisma.sql`f."language_iso_code2" = ${query.language}`);
      if (query.search) {
        const term = "%" + query.search.replace(/[%_\\]/g, "\\$&") + "%";
        conditions.push(Prisma.sql`(s."name" ILIKE ${term} OR f."feed_url" ILIKE ${term})`);
      }
      return Prisma.sql`
        SELECT r."id", r."batch_run_id" AS "batchRunId",
          ${type}::text AS "parserType",
          f."id" AS "feedId", f."feed_url" AS "feedUrl",
          s."name" AS "source", s."country_id"::text AS "country",
          f."language_iso_code2"::text AS "language",
          f."category_id"::text AS "categoryId",
          r."started_at" AS "startedAt", r."finished_at" AS "finishedAt",
          r."duration_ms" AS "durationMs", r."status" AS "status",
          r."items_found" AS "itemsFound", ${imported} AS "imported",
          ${skipped} AS "skipped", r."error_message" AS "errorMessage"
        FROM ${runTable} r
        JOIN ${feedTable} f ON f."id" = r.${foreign}
        JOIN "source" s ON s."id" = f."source_id"
        WHERE ${Prisma.join(conditions, " AND ")}
      `;
    }), " UNION ALL ");
  }

  private normalized(rows: RunRow[]) {
    return rows.map(row => ({
      ...row, errorMessage: safeError(row.errorMessage),
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }));
  }

  async summary(query: MonitoringQuery) {
    const { from, to } = monitoringRange(query);
    const combined = this.union(query, from, to);
    type Totals = { executions: bigint; succeeded: bigint; failed: bigint;
      running: bigint; errorFeeds: bigint; importedInfos: bigint; importedVideos: bigint;
      durationSum: bigint; durationCount: bigint; lastStarted: Date | null };
    const [totals] = await this.db.prisma.$queryRaw<Totals[]>`
      WITH r AS (${combined})
      SELECT COUNT(*)::bigint AS "executions",
        COUNT(*) FILTER (WHERE "status" = 'SUCCESS')::bigint AS "succeeded",
        COUNT(*) FILTER (WHERE "status" IN ('ERROR','INTERRUPTED'))::bigint AS "failed",
        COUNT(*) FILTER (WHERE "status" = 'RUNNING')::bigint AS "running",
        COUNT(DISTINCT ("parserType" || ':' || "feedId"::text))
          FILTER (WHERE "status" = 'ERROR')::bigint AS "errorFeeds",
        COALESCE(SUM("imported") FILTER (WHERE "parserType"='INFOS'),0)::bigint AS "importedInfos",
        COALESCE(SUM("imported") FILTER (WHERE "parserType"='VIDEOS'),0)::bigint AS "importedVideos",
        COALESCE(SUM("durationMs") FILTER (WHERE "status"<>'RUNNING'),0)::bigint AS "durationSum",
        COUNT("durationMs") FILTER (WHERE "status"<>'RUNNING')::bigint AS "durationCount",
        MAX("startedAt") AS "lastStarted"
      FROM r
    `;
    const [infosActive, videosActive] = await Promise.all([
      this.db.prisma.feed.count({ where: { isActive: true } }),
      this.db.prisma.feedVideo.count({ where: { isActive: true } }),
    ]);
    const n = (v: bigint | undefined) => Number(v ?? 0n);
    const success = n(totals?.succeeded);
    const failed = n(totals?.failed);
    const durCount = n(totals?.durationCount);
    const stats = {
      periodFrom: from.toISOString(), periodTo: to.toISOString(),
      activeFeeds: {
        infos: infosActive, videos: videosActive,
        total: query.parser === "INFOS" ? infosActive
          : query.parser === "VIDEOS" ? videosActive : infosActive + videosActive,
      },
      executions: n(totals?.executions), completed: success + failed,
      succeeded: success, failed, running: n(totals?.running),
      successRate: success + failed ? Math.round(success / (success + failed) * 1000) / 10 : null,
      errorFeeds: n(totals?.errorFeeds),
      importedInfos: n(totals?.importedInfos), importedVideos: n(totals?.importedVideos),
      averageDurationMs: durCount ? Math.round(n(totals?.durationSum) / durCount) : null,
      lastStarted: totals?.lastStarted?.toISOString() ?? null,
    };
    type Point = { bucket: string; parserType: string; status: string; total: bigint; imported: bigint };
    const granularity = query.period === "24h" ? "hour" : "day";
    const timeline = await this.db.prisma.$queryRaw<Point[]>`
      WITH r AS (${combined})
      SELECT to_char(date_trunc(${granularity}, "startedAt" AT TIME ZONE 'UTC'),
        'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "bucket",
        "parserType", "status",
        COUNT(*)::bigint AS "total", COALESCE(SUM("imported"),0)::bigint AS "imported"
      FROM r
      GROUP BY 1,2,3 ORDER BY 1 ASC
    `;
    return {
      ...stats,
      timeline: timeline.map(row => ({ ...row,
        total: Number(row.total), imported: Number(row.imported) })),
      panels: await this.panels(query, from, to),
    };
  }

  private async panels(query: MonitoringQuery, from: Date, to: Date) {
    const groups = (["INFOS", "VIDEOS"] as const)
      .filter(type => query.parser === "ALL" || query.parser === type);
    return Promise.all(groups.map(async type => {
      const combined = this.union({ ...query, parser: type }, from, to);
      const [row] = await this.db.prisma.$queryRaw<Array<{
        count: bigint; errors: bigint; succeeded: bigint; imported: bigint; lastRun: Date | null
      }>>`WITH r AS (${combined})
        SELECT COUNT(*)::bigint AS "count",
          COUNT(*) FILTER (WHERE "status"='ERROR')::bigint AS "errors",
          COUNT(*) FILTER (WHERE "status"='SUCCESS')::bigint AS "succeeded",
          COALESCE(SUM("imported"),0)::bigint AS "imported",
          MAX("startedAt") AS "lastRun" FROM r`;
      return {
        type, runs: Number(row?.count ?? 0), errors: Number(row?.errors ?? 0),
        succeeded: Number(row?.succeeded ?? 0), imported: Number(row?.imported ?? 0),
        lastRun: row?.lastRun?.toISOString() ?? null,
      };
    }));
  }

  async runs(query: MonitoringQuery, exportLimit?: number) {
    const { from, to } = monitoringRange(query);
    const combined = this.union(query, from, to);
    const offset = exportLimit ? 0 : (query.page - 1) * query.pageSize;
    const limit = exportLimit ?? query.pageSize;
    const [countRow] = await this.db.prisma.$queryRaw<Array<{ total: bigint }>>`
      WITH r AS (${combined}) SELECT COUNT(*)::bigint AS "total" FROM r`;
    const rows = await this.db.prisma.$queryRaw<RunRow[]>`
      WITH r AS (${combined}) SELECT * FROM r
      ORDER BY "startedAt" DESC, "id" DESC LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      rows: this.normalized(rows), pagination: {
        page: query.page, pageSize: limit, total: Number(countRow?.total ?? 0),
        totalPages: Math.ceil(Number(countRow?.total ?? 0) / limit),
      },
    };
  }

  async runDetail(id: string, type: "INFOS" | "VIDEOS") {
    const row = type === "INFOS"
      ? await this.db.prisma.feedRun.findUnique({
        where: { id }, include: { feed: { include: { source: true } } },
      })
      : await this.db.prisma.feedVideoRun.findUnique({
        where: { id }, include: { feedVideo: { include: { source: true } } },
      });
    if (!row) throw new NotFoundException("Exécution introuvable.");
    const feed = "feed" in row ? row.feed : row.feedVideo;
    return {
      id: row.id, type, status: row.status,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      durationMs: row.durationMs, itemsFound: row.itemsFound,
      imported: "articlesImported" in row ? row.articlesImported : row.videosImported,
      skipped: "articlesSkipped" in row ? row.articlesSkipped : row.videosSkipped,
      feedUrl: feed.feedUrl, source: feed.source.name,
      batchRunId: row.batchRunId, errorMessage: safeError(row.errorMessage),
    };
  }

  async batches(query: MonitoringQuery) {
    const { from, to } = monitoringRange(query);
    const where = {
      startedAt: { gte: from, lt: to },
      ...(query.parser !== "ALL" ? { parserType: query.parser } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.prisma.parserBatchRun.findMany({
        where, orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.db.prisma.parserBatchRun.count({ where }),
    ]);
    return { rows, pagination: { page: query.page, pageSize: query.pageSize,
      total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async events(batchId: string, page: number, pageSize: number, errorsOnly: boolean) {
    const batch = await this.db.prisma.parserBatchRun.findUnique({
      where: { id: batchId }, select: { id: true },
    });
    if (!batch) throw new NotFoundException("Lancement introuvable.");
    const where = { batchRunId: batchId, ...(errorsOnly ? { level: "ERROR" } : {}) };
    const [rows, total] = await Promise.all([
      this.db.prisma.parserRunEvent.findMany({
        where, orderBy: [{ timestamp: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.db.prisma.parserRunEvent.count({ where }),
    ]);
    return {
      rows: rows.map(row => ({ ...row, message: safeError(row.message) })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async alerts(query: MonitoringQuery) {
    const { from, to } = monitoringRange(query);
    const combined = this.union({ ...query, status: undefined }, from, to);
    // Only last three attempts per unique parser/flux count as repeated failures.
    const failures = await this.db.prisma.$queryRaw<Array<{
      parserType: string; feedId: string; source: string; feedUrl: string;
      failures: bigint; lastAttempt: Date;
    }>>`
      WITH r AS (${combined}), ranked AS (
        SELECT *, ROW_NUMBER() OVER(
          PARTITION BY "parserType","feedId" ORDER BY "startedAt" DESC,id DESC
        ) AS rn FROM r
      )
      SELECT "parserType", "feedId", MAX("source") AS "source",
        MAX("feedUrl") AS "feedUrl",
        COUNT(*) FILTER (WHERE "status"='ERROR')::bigint AS "failures",
        MAX("startedAt") AS "lastAttempt"
      FROM ranked WHERE rn <= 3 GROUP BY "parserType","feedId"
      HAVING COUNT(*) >= 3
        AND COUNT(*) FILTER (WHERE "status"='ERROR')=3
      ORDER BY "lastAttempt" DESC LIMIT 30
    `;
    const stuck = await this.db.prisma.$queryRaw<RunRow[]>`
      WITH r AS (${combined})
      SELECT * FROM r WHERE "status"='RUNNING'
        AND "startedAt" < ${new Date(Date.now()-30*60_000)}
      ORDER BY "startedAt" DESC LIMIT 30
    `;
    return {
      thresholds: { consecutiveFailures: 3, stuckMinutes: 30 },
      rows: [
        ...failures.map(row => ({
          type: "REPEATED_FAILURE", parserType: row.parserType, feedId: row.feedId,
          source: row.source, feedUrl: row.feedUrl,
          message: "3 dernières tentatives en échec", at: row.lastAttempt.toISOString(),
        })),
        ...stuck.map(row => ({
          type: "STUCK", parserType: row.parserType, feedId: row.feedId,
          source: row.source, feedUrl: row.feedUrl,
          message: "Exécution RUNNING depuis plus de 30 minutes",
          at: row.startedAt.toISOString(),
        })),
      ].slice(0, 50),
    };
  }

  async exportCsv(query: MonitoringQuery) {
    const data = await this.runs(query, 10_000);
    const fields = ["date","parser","source","flux","statut","durée_ms",
      "détectés","importés","ignorés","erreur"];
    const lines = data.rows.map(row => [
      row.startedAt,row.parserType,row.source,row.feedUrl,row.status,row.durationMs,
      row.itemsFound,row.imported,row.skipped,row.errorMessage,
    ].map(safeCsvCell).join(";"));
    return "\uFEFF" + fields.join(";") + "\r\n" + lines.join("\r\n") + "\r\n";
  }
}
