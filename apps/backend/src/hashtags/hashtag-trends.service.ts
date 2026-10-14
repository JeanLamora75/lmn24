import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

const SETTING_KEYS = [
  "hashtagTrendMinMentions",
  "hashtagTrendMinIncrease",
  "hashtagTrendScoreFloor",
] as const;
const RETENTION_KEYS = ["retentionArticlesDays", "retentionHashtagHourlyCountsDays"] as const;
const MARKER_KEYS = ["hashtagStatsLastFullRebuildAt", "hashtagStatsCoverageSinceUtc"] as const;
const CACHE_LIMIT = 3;
const HOUR_MS = 3_600_000;

export type TrendSettings = Readonly<{
  hashtagTrendMinMentions: number;
  hashtagTrendMinIncrease: number;
  hashtagTrendScoreFloor: number;
}>;

export type RankingPeriod = "24h" | "7d" | "30d";
export type RankingMode = "most-cited" | "trending";
export type RankingRequest = Readonly<{
  period: RankingPeriod;
  mode: RankingMode;
  page: number;
  pageSize: number;
}>;

type RankingItem = Readonly<{
  id: string; name: string; slug: string; imageUrl: string | null;
  mentions: number; previousMentions: number | null;
  changePercent: number | null; changeLabel: string;
  trendScore: number | null;
}>;

type RankingSnapshot = Readonly<{
  asOf: string;
  calculatedAt: string;
  period: RankingPeriod;
  comparisonAvailable: boolean;
  comparisonReason: string | null;
  freshness: "fresh" | "stale" | "unverified";
  lastFullRebuildAt: string | null;
  coverageSinceUtc: string | null;
  mostCited: readonly RankingItem[];
  trending: readonly RankingItem[];
}>;

const PERIOD_HOURS: Record<RankingPeriod, number> = {
  "24h": 24, "7d": 168, "30d": 720,
};

function positiveInteger(input: string, key: string): number {
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
    throw new ServiceUnavailableException("Paramètre de tendances invalide : " + key + ".");
  }
  return value;
}
function bySlug(a: { slug: string }, b: { slug: string }): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
function validUtcDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
function windowEnd(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
}
function offsetHours(value: Date, hours: number): Date {
  return new Date(value.getTime() - hours * HOUR_MS);
}

@Injectable()
export class HashtagTrendsService {
  private readonly cache = new Map<RankingPeriod, {
    key: string;
    snapshot: RankingSnapshot;
  }>();
  private readonly running = new Map<string, Promise<RankingSnapshot>>();

  constructor(private readonly db: DatabaseService) {}

  invalidate(): void { this.cache.clear(); }

  async getSettings(): Promise<TrendSettings> {
    const rows = await this.db.prisma.setting.findMany({
      where: { scope: "GLOBAL", scopeId: null, key: { in: [...SETTING_KEYS] } },
      select: { key: true, value: true, type: true },
    });
    const found = new Map(rows.map((r) => [r.key, r]));
    const result = {} as Record<typeof SETTING_KEYS[number], number>;
    for (const key of SETTING_KEYS) {
      const row = found.get(key);
      if (!row || row.type !== "INTEGER") {
        throw new ServiceUnavailableException("Paramètre " + key + " manquant. Exécutez seed_hashtag_trend_settings.sql.");
      }
      result[key] = positiveInteger(row.value, key);
    }
    return result;
  }

  async updateSettings(input: TrendSettings): Promise<TrendSettings> {
    for (const key of SETTING_KEYS) {
      const value = input[key];
      if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
        throw new BadRequestException("Le paramètre " + key + " doit être un entier positif.");
      }
    }
    await this.db.prisma.$transaction(async (tx) => {
      const found = await tx.setting.findMany({
        where: { scope: "GLOBAL", scopeId: null, key: { in: [...SETTING_KEYS] } },
        select: { key: true, type: true },
      });
      if (found.length !== SETTING_KEYS.length || found.some((x) => x.type !== "INTEGER")) {
        throw new ServiceUnavailableException("Initialisez les paramètres des tendances avec le script SQL prévu.");
      }
      for (const key of SETTING_KEYS) {
        const updated = await tx.setting.updateMany({
          where: { key, scope: "GLOBAL", scopeId: null, type: "INTEGER" },
          data: { value: String(input[key]) },
        });
        if (updated.count !== 1) {
          throw new ServiceUnavailableException("Enregistrement incomplet : " + key);
        }
      }
    });
    this.invalidate();
    return this.getSettings();
  }

  async rank(request: RankingRequest, now = new Date()) {
    const { period, mode, page, pageSize } = request;
    const config = await this.getSettings();
    const metaRows = await this.db.prisma.setting.findMany({
      where: { scope: "GLOBAL", scopeId: null,
        key: { in: [...RETENTION_KEYS, ...MARKER_KEYS] } },
      select: { key: true, value: true },
    });
    const metadata = new Map(metaRows.map((x) => [x.key, x.value]));
    const effectiveRetentionDays = Math.min(
      ...RETENTION_KEYS.map((key) => positiveInteger(metadata.get(key) ?? "60", key)),
    );
    const end = windowEnd(now);
    const signature = [
      end.toISOString(), ...SETTING_KEYS.map((key) => config[key]),
      effectiveRetentionDays,
      ...MARKER_KEYS.map((key) => metadata.get(key) ?? ""),
    ].join("|");
    const cached = this.cache.get(period);
    let snapshot: RankingSnapshot;
    if (cached?.key === signature) {
      snapshot = cached.snapshot;
    } else {
      const key = period + "|" + signature;
      const existing = this.running.get(key);
      if (existing) {
        snapshot = await existing;
      } else {
        const promise = this.buildSnapshot(period, config, metadata,
          effectiveRetentionDays, end, now);
        this.running.set(key, promise);
        try {
          snapshot = await promise;
          this.cache.set(period, { key: signature, snapshot });
          if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
        } finally { this.running.delete(key); }
      }
    }
    const list = mode === "trending" ? snapshot.trending : snapshot.mostCited;
    const totalPages = Math.ceil(list.length / pageSize);
    const currentPage = Math.min(page, Math.max(totalPages, 1));
    return {
      period, mode, asOf: snapshot.asOf, calculatedAt: snapshot.calculatedAt,
      freshness: snapshot.freshness,
      comparisonAvailable: snapshot.comparisonAvailable,
      comparisonReason: snapshot.comparisonReason,
      lastFullRebuildAt: snapshot.lastFullRebuildAt,
      coverageSinceUtc: snapshot.coverageSinceUtc,
      items: list.slice((currentPage - 1) * pageSize, currentPage * pageSize),
      pagination: { page: currentPage, pageSize, total: list.length, totalPages },
    };
  }

  private async buildSnapshot(
    period: RankingPeriod,
    config: TrendSettings,
    metadata: Map<string, string>,
    retentionDays: number,
    end: Date,
    now: Date,
  ): Promise<RankingSnapshot> {
    const hours = PERIOD_HOURS[period];
    const from = offsetHours(end, hours);
    const previousFrom = offsetHours(from, hours);
    const fullRebuild = validUtcDate(metadata.get("hashtagStatsLastFullRebuildAt"));
    const coverageSince = validUtcDate(metadata.get("hashtagStatsCoverageSinceUtc"));
    const stale = !fullRebuild || now.getTime() - fullRebuild.getTime() > 48 * HOUR_MS;
    // An initial/full rebuild proves the entire retained corpus was scanned.
    // Earliest actual article ingestion prevents calling a brand-new site a
    // rising trend when the comparison period predates its existence.
    const comparisonAvailable = retentionDays * 24 >= hours * 2
      && !stale && coverageSince !== null
      && coverageSince.getTime() <= previousFrom.getTime() + HOUR_MS;
    let comparisonReason: string | null = null;
    if (!comparisonAvailable) {
      comparisonReason = retentionDays * 24 < hours * 2
        ? "Durée de conservation insuffisante pour la comparaison."
        : stale
          ? "Reconstruction complète des statistiques absente ou trop ancienne."
          : "Historique de collecte insuffisant pour cette période.";
    }
    const hashtags = await this.db.prisma.hashtag.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, imageUrl: true },
    });
    if (!hashtags.length) return {
      asOf: end.toISOString(), calculatedAt: new Date().toISOString(),
      period, comparisonAvailable, comparisonReason,
      freshness: !fullRebuild ? "unverified" : stale ? "stale" : "fresh",
      lastFullRebuildAt: fullRebuild?.toISOString() ?? null,
      coverageSinceUtc: coverageSince?.toISOString() ?? null,
      mostCited: [], trending: [],
    };

    const ids = hashtags.map((x) => x.id);
    const [current, prior] = await Promise.all([
      this.db.prisma.hashtagHourlyCount.groupBy({
        by: ["hashtagId"],
        where: { hashtagId: { in: ids }, hourUtc: { gte: from, lt: end } },
        _sum: { articleCount: true },
      }),
      comparisonAvailable ? this.db.prisma.hashtagHourlyCount.groupBy({
        by: ["hashtagId"],
        where: { hashtagId: { in: ids }, hourUtc: { gte: previousFrom, lt: from } },
        _sum: { articleCount: true },
      }) : Promise.resolve([]),
    ]);
    const currentMap = new Map(current.map((r) => [r.hashtagId, r._sum.articleCount ?? 0]));
    const previousMap = new Map(prior.map((r) => [r.hashtagId, r._sum.articleCount ?? 0]));
    const items: RankingItem[] = hashtags.map((hashtag) => {
      const mentions = currentMap.get(hashtag.id) ?? 0;
      const previousMentions = comparisonAvailable ? previousMap.get(hashtag.id) ?? 0 : null;
      const difference = previousMentions === null ? null : mentions - previousMentions;
      const trendScore = previousMentions === null ? null
        : (difference! / Math.max(previousMentions, config.hashtagTrendScoreFloor));
      const changePercent = previousMentions === null || previousMentions === 0
        ? null : Math.round((difference! / previousMentions) * 100);
      const changeLabel = previousMentions === null ? "—"
        : previousMentions === 0 && mentions > 0 ? "Nouveau"
          : previousMentions === 0 ? "0 %" : (changePercent! > 0 ? "+" : "") + changePercent + " %";
      return { ...hashtag, mentions, previousMentions, changePercent,
        changeLabel, trendScore };
    });
    const mostCited = items.filter((r) => r.mentions >= 1).sort((a, b) =>
      b.mentions - a.mentions || bySlug(a, b));
    const trending = comparisonAvailable ? items.filter((r) =>
      r.mentions >= config.hashtagTrendMinMentions
      && r.previousMentions !== null
      && r.mentions - r.previousMentions >= config.hashtagTrendMinIncrease)
      .sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0)
        || b.mentions - a.mentions || bySlug(a, b)) : [];
    return {
      asOf: end.toISOString(), calculatedAt: new Date().toISOString(),
      period, comparisonAvailable, comparisonReason,
      freshness: !fullRebuild ? "unverified" : stale ? "stale" : "fresh",
      lastFullRebuildAt: fullRebuild?.toISOString() ?? null,
      coverageSinceUtc: coverageSince?.toISOString() ?? null,
      mostCited, trending,
    };
  }
}
