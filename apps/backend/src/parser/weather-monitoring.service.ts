import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { monitoringRange, type MonitoringQuery } from "./parser-monitoring.service";

export type WeatherMonitoringQuery = {
  period: MonitoringQuery["period"];
  from?: string | undefined; to?: string | undefined;
  status: "ALL" | "RUNNING" | "SUCCESS" | "PARTIAL" | "ERROR" | "INTERRUPTED";
  continent: "ALL" | "EU" | "AS" | "AF" | "NA" | "SA" | "OC";
  page: number; pageSize: number;
};

/** Run-level metrics use cities, never feed counts. */
@Injectable()
export class WeatherMonitoringService {
  constructor(private readonly db: DatabaseService) {}

  async overview(query: WeatherMonitoringQuery) {
    const { from, to } = monitoringRange({
      parser: "ALL", period: query.period, from: query.from, to: query.to,
      page: query.page, pageSize: query.pageSize,
    });
    const continent = query.continent === "ALL" ? undefined : query.continent;
    const where = {
      startedAt: { gte: from, lt: to },
      ...(continent ? { continentCode: continent } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
    };
    // Queries for numbers and rows use identical conditions. Keep pagination
    // separate from aggregate statistics so page changes don't alter KPIs.
    const [runs, total, activeCities, settings, lastSuccess, currentPresent,
      freshObservations, latestRuns] = await Promise.all([
      this.db.prisma.weatherRun.findMany({
        where, orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.db.prisma.weatherRun.count({ where }),
      this.db.prisma.weatherCity.count({
        where: { isActive: true, ...(continent ? { continentCode: continent } : {}) },
      }),
      this.db.prisma.setting.findFirst({
        where: { key: "weatherStaleAfterMinutes", scope: "GLOBAL" },
        select: { value: true },
      }),
      this.db.prisma.weatherRun.findFirst({
        where: { ...where, status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
      }),
      this.db.prisma.weatherCurrent.count({
        where: { city: { isActive: true,
          ...(continent ? { continentCode: continent } : {}) } },
      }),
      // Temporary placeholder for query parallelization; a freshCount is below.
      Promise.resolve(0),
      this.db.prisma.weatherRun.findMany({
        where, orderBy: [{ startedAt: "desc" }], take: 500,
        select: {
          status: true, totalCities: true, processedCities: true,
          successfulCities: true, failedCities: true,
          startedAt: true, finishedAt: true, errorMessage: true,
          continentCode: true, id: true,
        },
      }),
    ]);
    void freshObservations;
    const rawStale = Number(settings?.value ?? 180);
    const staleAfterMinutes = Number.isFinite(rawStale) && rawStale > 0
      ? Math.min(43200, Math.trunc(rawStale)) : 180;
    const threshold = new Date(Date.now() - staleAfterMinutes * 60_000);
    const freshCities = await this.db.prisma.weatherCurrent.count({
      where: {
        observedAt: { gte: threshold },
        city: { isActive: true, ...(continent ? { continentCode: continent } : {}) },
      },
    });
    const succeeded = latestRuns.filter(row => row.status === "SUCCESS").length;
    const partial = latestRuns.filter(row => row.status === "PARTIAL").length;
    const failed = latestRuns.filter(row => ["ERROR", "INTERRUPTED"].includes(row.status)).length;
    const running = latestRuns.filter(row => row.status === "RUNNING").length;
    const totalProcessed = latestRuns.reduce((sum, row) => sum + row.processedCities, 0);
    const totalSuccessful = latestRuns.reduce((sum, row) => sum + row.successfulCities, 0);
    const totalFailed = latestRuns.reduce((sum, row) => sum + row.failedCities, 0);
    const durations = latestRuns
      .filter(row => row.finishedAt !== null)
      .map(row => Math.max(0, row.finishedAt!.getTime() - row.startedAt.getTime()));
    const latest = latestRuns[0];
    const repeatedErrors = latestRuns.length >= 3
      && latestRuns.slice(0, 3).every(row => row.status === "ERROR");
    const stuck = latestRuns.find(row =>
      row.status === "RUNNING" && row.startedAt.getTime() < Date.now() - 45 * 60_000,
    );
    const alerts = [
      ...(stuck ? [{ type: "STUCK", message: "Collecte météo en cours depuis plus de 45 minutes.",
        at: stuck.startedAt.toISOString() }] : []),
      ...(repeatedErrors ? [{ type: "REPEATED_FAILURE",
        message: "Les trois dernières collectes météo sont en erreur.",
        at: latest!.startedAt.toISOString() }] : []),
      ...(activeCities > 0 && freshCities < activeCities
        ? [{ type: "STALE_WEATHER",
          message: (activeCities - freshCities) + " ville(s) sans météo suffisamment récente.",
          at: threshold.toISOString() }] : []),
    ];
    return {
      periodFrom: from.toISOString(), periodTo: to.toISOString(),
      activeCities, currentPresent, freshCities,
      staleCities: Math.max(0, activeCities - freshCities), staleAfterMinutes,
      executions: total, succeeded, partial, failed, running,
      // Metrics from the 500 most recent runs are explicitly windowed.
      statsSampleSize: latestRuns.length,
      sampleTruncated: total > latestRuns.length,
      processedCities: totalProcessed, successfulCities: totalSuccessful,
      failedCities: totalFailed,
      averageDurationMs: durations.length
        ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : null,
      lastStarted: latest?.startedAt.toISOString() ?? null,
      lastSuccess: lastSuccess?.finishedAt?.toISOString()
        ?? lastSuccess?.startedAt.toISOString() ?? null,
      alerts, rows: runs.map(row => ({
        ...row,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        errorMessage: row.errorMessage?.slice(0,1024) ?? null,
      })),
      pagination: { page: query.page, pageSize: query.pageSize, total,
        totalPages: Math.ceil(total/query.pageSize) },
    };
  }
}
