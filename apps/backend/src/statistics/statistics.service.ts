import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export type StatisticsFilters = {
  period: "24h" | "7d" | "30d" | "90d" | "custom";
  from?: string | undefined;
  to?: string | undefined;
  countryId?: string | undefined;
  categoryId?: string | undefined;
  language?: string | undefined;
  sourceId?: string | undefined;
};

@Injectable()
export class StatisticsService {
  constructor(private readonly database: DatabaseService) {}

  async dashboard(filters: StatisticsFilters) {
    const prisma = this.database.prisma;
    const now = new Date();
    const durations = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, custom: 7 };
    const start = filters.period === "custom" && filters.from
      ? new Date(filters.from + "T00:00:00.000Z")
      : new Date(now.getTime() - durations[filters.period] * 86400000);
    const end = filters.period === "custom" && filters.to
      ? new Date(filters.to + "T23:59:59.999Z") : now;
    const scope = {
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.language ? { languageIsoCode2: filters.language } : {}),
      ...(filters.countryId ? { source: { countryId: filters.countryId } } : {}),
    };
    const dateWhere = { ...scope, createdAt: { gte: start, lte: end } };
    const sourceScope = {
      ...(filters.countryId ? { countryId: filters.countryId } : {}),
      ...(filters.sourceId ? { id: filters.sourceId } : {}),
    };
    const feedScope = {
      ...(filters.countryId || filters.sourceId ? { source: sourceScope } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.language ? { languageIsoCode2: filters.language } : {}),
    };
    const [sources, sourceTotal, sourceActive, feedTotal, feedActive, articleTotal,
      periodTotal, countries, categories, languages, articleRows, runs, feeds] = await Promise.all([
      prisma.source.findMany({
        where: sourceScope, select: {
          id: true, name: true, countryId: true, websiteUrl: true, logoUrl: true,
          description: true, rssPageUrl: true, xUrl: true, facebookUrl: true,
          instagramUrl: true, youtubeUrl: true, _count: { select: { feeds: true, articles: true } },
        },
      }),
      prisma.source.count({ where: sourceScope }),
      prisma.source.count({ where: { ...sourceScope, isActive: true } }),
      prisma.feed.count({ where: feedScope }),
      prisma.feed.count({ where: { ...feedScope, isActive: true } }),
      prisma.article.count({ where: scope }),
      prisma.article.count({ where: dateWhere }),
      prisma.country.findMany({ select: { id: true, isoCode2: true } }),
      prisma.category.findMany({ select: { id: true, slug: true } }),
      prisma.language.findMany({ select: { isoCode2: true } }),
      prisma.article.findMany({
        where: dateWhere, select: {
          id: true, sourceId: true, categoryId: true, languageIsoCode2: true,
          createdAt: true, publishedAt: true, source: { select: { countryId: true } },
        }, orderBy: { createdAt: "desc" }, take: 100000,
      }),
      prisma.feedRun.findMany({
        where: { startedAt: { gte: start, lte: end }, feed: feedScope },
        select: { status: true, durationMs: true, itemsFound: true,
          articlesImported: true, articlesSkipped: true, errorMessage: true,
          startedAt: true, feedId: true },
        orderBy: { startedAt: "desc" }, take: 10000,
      }),
      prisma.feed.findMany({ where: feedScope, select: {
        id: true, feedUrl: true, isActive: true, lastFetchStatus: true,
        lastFetchedAt: true, lastError: true, sourceId: true,
        source: { select: { name: true } },
      } }),
    ]);

    const countBy = (values: string[]) => {
      const totals = new Map<string, number>();
      for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
      return [...totals.entries()].map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
    };
    const countryNames = new Map(countries.map((x) => [x.id, x.isoCode2.trim()]));
    const categoryNames = new Map(categories.map((x) => [x.id, x.slug]));
    const sourceNames = new Map(sources.map((x) => [x.id, x.name]));
    const countriesData = countBy(articleRows.map((x) => x.source.countryId))
      .map((x) => ({ name: countryNames.get(x.key) ?? x.key, count: x.count }));
    const categoryData = countBy(articleRows.map((x) => x.categoryId))
      .map((x) => ({ name: categoryNames.get(x.key) ?? x.key, count: x.count }));
    const languageData = countBy(articleRows.map((x) => x.languageIsoCode2.trim()))
      .map((x) => ({ name: x.key, count: x.count }));
    const sourceData = countBy(articleRows.map((x) => x.sourceId))
      .slice(0, 10).map((x) => ({ name: sourceNames.get(x.key) ?? x.key, count: x.count, id: x.key }));
    const days = countBy(articleRows.map((x) => x.createdAt.toISOString().slice(0, 10)))
      .sort((a, b) => a.key.localeCompare(b.key));
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, "0") + "h",
      count: articleRows.filter((x) => x.createdAt.getUTCHours() === hour).length,
    }));
    const matrix = countriesData.slice(0, 10).map((country) => ({
      country: country.name,
      categories: categoryData.slice(0, 10).map((category) => ({
        name: category.name,
        count: articleRows.filter((x) =>
          (countryNames.get(x.source.countryId) ?? x.source.countryId) === country.name &&
          (categoryNames.get(x.categoryId) ?? x.categoryId) === category.name).length,
      })),
    }));
    const present = (value: string | null) => Boolean(value?.trim());
    const metrics = [
      { key: "feeds", label: "Avec flux RSS", count: sources.filter((s) => s._count.feeds > 0).length },
      { key: "description", label: "Avec description", count: sources.filter((s) => present(s.description)).length },
      { key: "image", label: "Avec image", count: sources.filter((s) => present(s.logoUrl)).length },
      { key: "rssPage", label: "Avec page RSS", count: sources.filter((s) => present(s.rssPageUrl)).length },
      ...(["xUrl", "facebookUrl", "instagramUrl", "youtubeUrl"] as const).map((key) => ({
        key, label: key.replace("Url", ""), count: sources.filter((s) => present(s[key])).length,
      })),
    ];
    const completeness = sources.map((s) => ({
      id: s.id, name: s.name,
      score: Math.round(100 * ([s._count.feeds > 0, present(s.description),
        present(s.logoUrl), present(s.rssPageUrl), present(s.xUrl),
        present(s.facebookUrl), present(s.instagramUrl), present(s.youtubeUrl)]
        .filter(Boolean).length / 8)),
    })).sort((a, b) => a.score - b.score).slice(0, 10);
    const failure = (status: string | null) => Boolean(status && /fail|error|timeout|invalid/i.test(status));
    const failures = feeds.filter((f) => f.isActive && failure(f.lastFetchStatus));
    const stale = (daysAgo: number) => feeds.filter((f) => f.isActive &&
      (!f.lastFetchedAt || f.lastFetchedAt.getTime() < now.getTime() - daysAgo * 86400000)).length;
    const durationsMs = runs.map((r) => r.durationMs).filter((v): v is number => v !== null);
    const success = runs.filter((r) => /success|ok|completed/i.test(r.status)).length;
    const errors = countBy(runs.filter((r) => failure(r.status))
      .map((r) => r.errorMessage?.trim() || r.status)).slice(0, 8);
    const daySpan = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    return {
      generatedAt: now.toISOString(),
      period: { from: start.toISOString(), to: end.toISOString() },
      filters: { countries, categories, languages, sources: sources.map((s) => ({ id: s.id, name: s.name })) },
      overview: { sources: sourceTotal, activeSources: sourceActive, feeds: feedTotal,
        activeFeeds: feedActive, articles: articleTotal, periodArticles: periodTotal,
        countries: new Set(sources.map((s) => s.countryId)).size,
        categories: categories.length, languages: languages.length },
      editorial: { periodArticles: periodTotal, dailyAverage: Math.round(periodTotal / daySpan),
        byDay: days.map((x) => ({ name: x.key, count: x.count })),
        byHour: hours, topSources: sourceData },
      distribution: { byCountry: countriesData, byCategory: categoryData,
        byLanguage: languageData, matrix },
      health: { operational: feeds.filter((f) => f.isActive && /success|ok|completed/i.test(f.lastFetchStatus ?? "")).length,
        failing: failures.length, monitoring: feeds.filter((f) => f.isActive &&
          !failure(f.lastFetchStatus) && !/success|ok|completed/i.test(f.lastFetchStatus ?? "")).length,
        totalRuns: runs.length, successRate: runs.length ? Math.round(success * 100 / runs.length) : null,
        averageDurationMs: durationsMs.length ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length) : null,
        found: runs.reduce((v, r) => v + r.itemsFound, 0),
        imported: runs.reduce((v, r) => v + r.articlesImported, 0),
        skipped: runs.reduce((v, r) => v + r.articlesSkipped, 0),
        stale24h: stale(1), stale7d: stale(7), stale30d: stale(30),
        errors, anomalies: failures.slice(0, 10).map((f) => ({
          id: f.id, name: f.source.name, status: f.lastFetchStatus, message: f.lastError,
        })) },
      quality: { metrics: metrics.map((m) => ({
        ...m, rate: sourceTotal ? Math.round(m.count * 100 / sourceTotal) : null,
      })), leastComplete: completeness,
        globalScore: sourceTotal ? Math.round(metrics.reduce((v, m) => v + m.count, 0) * 100 / (sourceTotal * 8)) : null },
      actions: { withoutFeeds: sources.filter((s) => s._count.feeds === 0).length,
        withoutArticles: sources.filter((s) => s._count.articles === 0).length,
        withoutImage: sources.filter((s) => !present(s.logoUrl)).length,
        incomplete: completeness.length, failedFeeds: failures.length, staleFeeds: stale(7) },
    };
  }
}
