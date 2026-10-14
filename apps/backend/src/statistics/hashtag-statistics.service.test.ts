import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "../hashtags/hashtag-trends.service";
import { buildHashtagTimeSeries, HashtagStatisticsService } from "./hashtag-statistics.service";

const now = new Date("2026-10-14T12:30:00.000Z");
const asOf = "2026-10-14T12:00:00.000Z";
const full = "2026-10-14T11:00:00.000Z";
const since = "2026-06-01T00:00:00.000Z";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const inactive = "33333333-3333-4333-8333-333333333333";
const topics = [
  { id: first, name: "Ukraine", slug: "ukraine", imageUrl: null,
    isActive: true, _count: { aliases: 2 } },
  { id: second, name: "Moscou", slug: "moscou", imageUrl: "/img.webp",
    isActive: true, _count: { aliases: 0 } },
  { id: inactive, name: "Inactive", slug: "inactive", imageUrl: null,
    isActive: false, _count: { aliases: 5 } },
];
function createHarness(freshness: "fresh" | "unverified" = "fresh") {
  const ranks = vi.fn(async (request: { period: string; mode: string }) => ({
    period: request.period, mode: request.mode, asOf,
    calculatedAt: full, freshness,
    comparisonAvailable: freshness === "fresh", comparisonReason:
      freshness === "fresh" ? null : "Reconstruction manquante",
    lastFullRebuildAt: freshness === "fresh" ? full : null,
    coverageSinceUtc: freshness === "fresh" ? since : null,
    items: request.mode === "most-cited" ? [
      { id: first, name: "Ukraine", slug: "ukraine", imageUrl: null,
        mentions: 8, previousMentions: 2, changePercent: 300,
        changeLabel: "+300 %", trendScore: 2 },
    ] : [
      { id: first, name: "Ukraine", slug: "ukraine", imageUrl: null,
        mentions: 8, previousMentions: 2, changePercent: 300,
        changeLabel: "+300 %", trendScore: 2 },
    ],
    pagination: { total: request.mode === "trending" ? 1 : 2, page: 1,
      pageSize: 10, totalPages: 1 },
  }));
  const groupBy = vi.fn(async () => [
    { hashtagId: first, _sum: { articleCount: 8 } },
  ]);
  const findManyCounts = vi.fn(async () => [
    { hashtagId: first, hourUtc: new Date("2026-10-14T10:00:00Z"),
      articleCount: 8 },
  ]);
  const prisma = {
    hashtag: { findMany: vi.fn().mockResolvedValue(topics) },
    hashtagAlias: { count: vi.fn().mockResolvedValue(7) },
    hashtagHourlyCount: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 99 }, _min: { hourUtc: new Date(since) },
        _max: { hourUtc: new Date(asOf) },
      }),
      groupBy, findMany: findManyCounts,
    },
    article: { findMany: vi.fn() },
  };
  const service = new HashtagStatisticsService(
    { prisma } as unknown as DatabaseService,
    { rank: ranks } as unknown as HashtagTrendsService,
  );
  return { service, prisma, ranks, groupBy, findManyCounts };
}
describe("SCRUM-59 — aggregations and public rankings reuse", () => {
  it("computes all six KPIs with active-only mention counts and full-stock alias counts", async () => {
    const { service, prisma, ranks, groupBy } = createHarness();
    const data = await service.dashboard("7d", [], now);
    expect(data.indicators).toEqual({
      registered: 3, active: 2, activeRate: 67, aliases: 7,
      mentions: 8, cited: 1, trending: 1,
    });
    expect(data.quality.withoutAlias).toBe(1);
    expect(data.quality.withoutImage).toBe(1);
    expect(data.quality.averageAliases).toBe(1);
    expect(data.quality.uncitedPeriod).toBe(1);
    expect(data.quality.uncited30d).toBe(1);
    expect(data.health.comparison30dAvailable).toBe(true);
    expect(data.top.mostCited[0]?.name).toBe("Ukraine");
    expect(data.top.trending[0]?.changeLabel).toBe("+300 %");
    expect(ranks).toHaveBeenCalledWith({
      period: "30d", mode: "trending", page: 1, pageSize: 10,
    }, now);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        hashtagId: { in: [first, second] },
      }),
    }));
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it("does not present missing history as zero mentions, empty trends or empty series", async () => {
    const { service, findManyCounts } = createHarness("unverified");
    const result = await service.dashboard("24h", [], now);
    expect(result.indicators.mentions).toBeNull();
    expect(result.indicators.cited).toBeNull();
    expect(result.indicators.trending).toBeNull();
    expect(result.quality.uncitedPeriod).toBeNull();
    expect(result.quality.uncited30d).toBeNull();
    expect(result.timeline.available).toBe(false);
    expect(result.timeline.points).toEqual([]);
    expect(findManyCounts).not.toHaveBeenCalled();
    expect(result.top.comparisonAvailable).toBe(false);
  });

  it("rejects inactive, unknown or more than five topics before querying the series", async () => {
    const { service, findManyCounts } = createHarness();
    await expect(service.dashboard("7d", [inactive], now))
      .rejects.toThrow(BadRequestException);
    await expect(service.dashboard("7d", ["wrong"], now))
      .rejects.toThrow(BadRequestException);
    await expect(service.dashboard("7d", Array(6).fill(first), now))
      .rejects.toThrow(BadRequestException);
    expect(findManyCounts).not.toHaveBeenCalled();
  });

  it("uses only selected active topics and same closed UTC hour as SCRUM-53", async () => {
    const { service, findManyCounts } = createHarness();
    const result = await service.dashboard("24h", [second], now);
    expect(result.timeline.selected.map((item) => item.id)).toEqual([second]);
    expect(result.timeline.points).toHaveLength(24);
    expect(result.timeline.points[0]?.at).toBe("2026-10-13T12:00:00.000Z");
    expect(findManyCounts).toHaveBeenCalledWith(expect.objectContaining({
      where: { hashtagId: { in: [second] },
        hourUtc: { gte: new Date("2026-10-13T12:00:00.000Z"),
          lt: new Date(asOf) } },
      take: 3600,
    }));
  });

  it("groups hourly UTC buckets without shifting the 7-day/30-day boundaries", () => {
    const start = new Date("2026-10-07T12:00:00.000Z");
    const rows = [
      { hashtagId: first, hourUtc: new Date("2026-10-07T12:00:00Z"), articleCount: 2 },
      { hashtagId: first, hourUtc: new Date("2026-10-08T11:00:00Z"), articleCount: 3 },
      { hashtagId: second, hourUtc: new Date("2026-10-08T12:00:00Z"), articleCount: 7 },
      { hashtagId: first, hourUtc: new Date("2026-10-14T12:00:00Z"), articleCount: 90 },
    ];
    const series = buildHashtagTimeSeries(start, "7d", [first, second], rows);
    expect(series).toHaveLength(7);
    expect(series[0]?.values).toEqual([5, 0]);
    expect(series[1]?.values).toEqual([0, 7]);
    expect(series[6]?.values).toEqual([0, 0]);
    expect(buildHashtagTimeSeries(start, "30d", [first], []))
      .toHaveLength(30);
  });
});
