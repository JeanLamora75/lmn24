import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {
  HashtagTrendsService, type RankingPeriod,
} from "../hashtags/hashtag-trends.service";

const HOUR_MS = 3_600_000;
const PERIOD_HOURS: Record<RankingPeriod, number> = {
  "24h": 24, "7d": 168, "30d": 720,
};
const PALETTE = ["#0d6efd", "#dc3545", "#198754", "#fd7e14", "#6f42c1"];

export type HashtagStatisticsPeriod = RankingPeriod;

export function buildHashtagTimeSeries(
  start: Date,
  period: RankingPeriod,
  ids: readonly string[],
  counts: readonly { hashtagId: string; hourUtc: Date; articleCount: number }[],
) {
  const stepHours = period === "24h" ? 1 : 24;
  const buckets = PERIOD_HOURS[period] / stepHours;
  const indexed = new Map<string, number>();
  for (const row of counts) {
    const offsetHours = Math.floor((row.hourUtc.getTime() - start.getTime()) / HOUR_MS);
    const bucket = Math.floor(offsetHours / stepHours);
    if (bucket < 0 || bucket >= buckets || !ids.includes(row.hashtagId)) continue;
    const key = row.hashtagId + ":" + bucket;
    indexed.set(key, (indexed.get(key) ?? 0) + row.articleCount);
  }
  return Array.from({ length: buckets }, (_, i) => ({
    at: new Date(start.getTime() + i * stepHours * HOUR_MS).toISOString(),
    values: ids.map((id) => indexed.get(id + ":" + i) ?? 0),
  }));
}

@Injectable()
export class HashtagStatisticsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trends: HashtagTrendsService,
  ) {}

  async dashboard(period: RankingPeriod, requestedIds: readonly string[] = [], now = new Date()) {
    if (requestedIds.length > 5 || new Set(requestedIds).size !== requestedIds.length) {
      throw new BadRequestException("Au maximum cinq hashtags distincts.");
    }
    const prisma = this.db.prisma;
    // Same closed UTC-hour cutoff as SCRUM-53 and the public rankings.
    const most = await this.trends.rank({
      period, mode: "most-cited", page: 1, pageSize: 10,
    }, now);
    const rising = await this.trends.rank({
      period, mode: "trending", page: 1, pageSize: 10,
    }, now);
    const monthlyComparison = period === "30d" ? rising : await this.trends.rank({
      period: "30d", mode: "trending", page: 1, pageSize: 10,
    }, now);
    const end = new Date(most.asOf);
    const from = new Date(end.getTime() - PERIOD_HOURS[period] * HOUR_MS);
    const start30 = new Date(end.getTime() - 720 * HOUR_MS);
    const nowMs = now.getTime();
    const fullRebuild = most.lastFullRebuildAt
      ? new Date(most.lastFullRebuildAt) : null;
    const coverage = most.coverageSinceUtc ? new Date(most.coverageSinceUtc) : null;
    const fresh = most.freshness === "fresh"
      && fullRebuild !== null && Number.isFinite(fullRebuild.getTime())
      && nowMs - fullRebuild.getTime() <= 48 * HOUR_MS;
    const hasCoverage = (date: Date) => fresh && coverage !== null
      && Number.isFinite(coverage.getTime()) && coverage.getTime() <= date.getTime();

    const [hashtagRows, allAliases, hourlyHealth] = await Promise.all([
      prisma.hashtag.findMany({
        select: {
          id: true, slug: true, name: true, imageUrl: true,
          isActive: true, _count: { select: { aliases: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.hashtagAlias.count(),
      prisma.hashtagHourlyCount.aggregate({
        _count: { _all: true },
        _min: { hourUtc: true },
        _max: { hourUtc: true },
      }),
    ]);

    const active = hashtagRows.filter((row) => row.isActive);
    const activeIds = active.map((row) => row.id);
    const activeSet = new Set(activeIds);
    const ids = requestedIds.length
      ? [...new Set(requestedIds)] : most.items.slice(0, 3).map((row) => row.id);
    if (ids.length > 5 || ids.some((id) => !activeSet.has(id))) {
      throw new BadRequestException("Sélectionnez de un à cinq hashtags actifs.");
    }
    // Stock KPI is global; time-dependent metrics use active hashtags only.
    const [periodGroups, monthGroups, rangeGroups, selectedRows] = await Promise.all([
      activeIds.length ? prisma.hashtagHourlyCount.groupBy({
        by: ["hashtagId"],
        where: { hashtagId: { in: activeIds }, hourUtc: { gte: from, lt: end } },
        _sum: { articleCount: true },
      }) : Promise.resolve([]),
      activeIds.length && hasCoverage(start30)
        ? prisma.hashtagHourlyCount.groupBy({
          by: ["hashtagId"],
          where: { hashtagId: { in: activeIds }, hourUtc: { gte: start30, lt: end } },
          _sum: { articleCount: true },
        }) : Promise.resolve([]),
      activeIds.length && fresh && coverage
        ? prisma.hashtagHourlyCount.groupBy({
          by: ["hashtagId"],
          where: {
            hashtagId: { in: activeIds },
            hourUtc: { gte: coverage, lt: end },
          },
          _sum: { articleCount: true },
        }) : Promise.resolve([]),
      ids.length && hasCoverage(from)
        ? prisma.hashtagHourlyCount.findMany({
          where: { hashtagId: { in: ids }, hourUtc: { gte: from, lt: end } },
          select: { hashtagId: true, hourUtc: true, articleCount: true },
          orderBy: [{ hourUtc: "asc" }, { hashtagId: "asc" }],
          take: 3600,
        }) : Promise.resolve([]),
    ]);

    const withMentions = (groups: readonly { hashtagId: string; _sum: { articleCount: number | null } }[]) =>
      new Set(groups.filter((row) => (row._sum.articleCount ?? 0) > 0)
        .map((row) => row.hashtagId));

    const cited = withMentions(periodGroups);
    const withoutAlias = active.filter((row) => row._count.aliases === 0);
    const withoutImage = active.filter((row) => !row.imageUrl?.trim());
    const examples = (rows: typeof active) => rows.slice(0, 8)
      .map(({ id, slug, name }) => ({ id, slug, name }));
    const selected = ids.map((id, index) => {
      const topic = active.find((item) => item.id === id)!;
      return { id, slug: topic.slug, name: topic.name, color: PALETTE[index]! };
    });
    const covered = hasCoverage(from);

    return {
      period, asOf: most.asOf, calculatedAt: most.calculatedAt,
      scope: "global" as const,
      indicators: {
        registered: hashtagRows.length,
        active: active.length,
        activeRate: hashtagRows.length
          ? Math.round(active.length / hashtagRows.length * 100) : null,
        aliases: allAliases,
        // Associations article × hashtag, not unique article counts.
        mentions: covered ? periodGroups.reduce(
          (sum, row) => sum + (row._sum.articleCount ?? 0), 0) : null,
        cited: covered ? cited.size : null,
        trending: rising.comparisonAvailable ? rising.pagination.total : null,
      },
      top: {
        mostCited: most.items,
        trending: rising.comparisonAvailable ? rising.items : [],
        comparisonAvailable: rising.comparisonAvailable,
        comparisonReason: rising.comparisonReason,
      },
      timeline: {
        available: covered,
        reason: covered ? null : "Historique incomplet ou reconstruction trop ancienne.",
        selected,
        options: active.map(({ id, name, slug }) => ({ id, name, slug })),
        points: covered ? buildHashtagTimeSeries(from, period, ids, selectedRows) : [],
        bucket: period === "24h" ? "hour" : "trailing-24h",
      },
      quality: {
        activeDenominator: active.length,
        withoutAlias: withoutAlias.length, withoutAliasExamples: examples(withoutAlias),
        withoutImage: withoutImage.length, withoutImageExamples: examples(withoutImage),
        averageAliases: active.length
          ? Math.round(active.reduce((sum, row) => sum + row._count.aliases, 0)
            / active.length * 100) / 100 : null,
        uncitedPeriod: covered ? active.length - cited.size : null,
        uncited30d: hasCoverage(start30)
          ? active.length - withMentions(monthGroups).size : null,
        uncitedCoverage: fresh && coverage
          ? active.length - withMentions(rangeGroups).size : null,
      },
      health: {
        freshness: most.freshness,
        comparisonAvailable: rising.comparisonAvailable,
        comparisonReason: rising.comparisonReason,
        comparison30dAvailable: monthlyComparison.comparisonAvailable,
        comparison30dReason: monthlyComparison.comparisonReason,
        lastFullRebuildAt: most.lastFullRebuildAt,
        coverageSinceUtc: most.coverageSinceUtc,
        bucketCount: hourlyHealth._count._all,
        firstHour: hourlyHealth._min.hourUtc?.toISOString() ?? null,
        lastHour: hourlyHealth._max.hourUtc?.toISOString() ?? null,
        calculatedAt: most.calculatedAt,
        currentPeriodCovered: covered,
      },
    };
  }
}
