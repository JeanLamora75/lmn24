import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "./hashtag-trends.service";

const now = new Date("2026-10-14T08:42:00.000Z");
const settings = [
  { key: "hashtagTrendMinMentions", type: "INTEGER", value: "10" },
  { key: "hashtagTrendMinIncrease", type: "INTEGER", value: "5" },
  { key: "hashtagTrendScoreFloor", type: "INTEGER", value: "5" },
];
const meta = [
  { key: "retentionArticlesDays", value: "60" },
  { key: "retentionHashtagHourlyCountsDays", value: "60" },
  { key: "hashtagStatsLastFullRebuildAt", value: "2026-10-14T07:30:00.000Z" },
  { key: "hashtagStatsCoverageSinceUtc", value: "2026-08-01T00:00:00.000Z" },
];
const subjects = [
  { id: "1", name: "Zidane", slug: "zidane", imageUrl: null },
  { id: "2", name: "Moscou", slug: "moscou", imageUrl: "/api/media/hashtags/test.webp" },
  { id: "3", name: "Rome", slug: "rome", imageUrl: null },
];

function factory(override?: { settings?: typeof settings; meta?: typeof meta; retention?: number }) {
  const allSettings = override?.settings ?? settings;
  const metadata = override?.meta ?? meta;
  const findMany = vi.fn(async (query: { where: { key: { in: readonly string[] } } }) =>
    query.where.key.in.includes("hashtagTrendMinMentions") ? allSettings : metadata);
  const groupBy = vi.fn(async (query: { where: { hourUtc: { gte: Date; lt: Date } } }) => {
    const from = query.where.hourUtc.gte;
    const isCurrent = from.toISOString() === "2026-10-13T08:00:00.000Z";
    return isCurrent
      ? [{ hashtagId: "1", _sum: { articleCount: 20 } },
        { hashtagId: "2", _sum: { articleCount: 14 } },
        { hashtagId: "3", _sum: { articleCount: 2 } }]
      : [{ hashtagId: "1", _sum: { articleCount: 10 } },
        { hashtagId: "3", _sum: { articleCount: 1 } }];
  });
  const prisma = {
    setting: { findMany },
    hashtag: { findMany: vi.fn().mockResolvedValue(subjects) },
    hashtagHourlyCount: { groupBy },
    $transaction: vi.fn(),
  };
  return { trends: new HashtagTrendsService({ prisma } as unknown as DatabaseService), prisma };
}

describe("SCRUM-53 — rankings on closed UTC hours", () => {
  it("ranks the most cited on 24h and compares with the previous 24h", async () => {
    const { trends, prisma } = factory();
    const result = await trends.rank({ period: "24h", mode: "most-cited", page: 1, pageSize: 10 }, now);
    expect(result.asOf).toBe("2026-10-14T08:00:00.000Z");
    expect(result.comparisonAvailable).toBe(true);
    expect(result.items.map((r) => r.slug)).toEqual(["zidane", "moscou", "rome"]);
    expect(result.items[0]).toMatchObject({
      mentions: 20, previousMentions: 10, changePercent: 100, changeLabel: "+100 %",
    });
    expect(result.items[1]).toMatchObject({
      mentions: 14, previousMentions: 0, changeLabel: "Nouveau", changePercent: null,
    });
    const calls = prisma.hashtagHourlyCount.groupBy.mock.calls.map(([q]) => q.where.hourUtc);
    expect(calls).toEqual([
      { gte: new Date("2026-10-13T08:00:00Z"), lt: new Date("2026-10-14T08:00:00Z") },
      { gte: new Date("2026-10-12T08:00:00Z"), lt: new Date("2026-10-13T08:00:00Z") },
    ]);
  });

  it("uses configurable thresholds and score floor for rising trends", async () => {
    const { trends } = factory();
    const result = await trends.rank({ period: "24h", mode: "trending", page: 1, pageSize: 20 }, now);
    expect(result.items.map((r) => r.slug)).toEqual(["moscou", "zidane"]);
    expect(result.items[0]?.trendScore).toBeCloseTo(2.8);
    expect(result.items[1]?.trendScore).toBeCloseTo(1);
    expect(result.items.every((r) => r.mentions >= 10)).toBe(true);
  });

  it("does not recompute the same period twice within an hour", async () => {
    const { trends, prisma } = factory();
    const input = { period: "24h" as const, mode: "most-cited" as const, page: 1, pageSize: 1 };
    await trends.rank(input, now);
    const pageTwo = await trends.rank({ ...input, page: 2 }, now);
    expect(pageTwo.items[0]?.slug).toBe("moscou");
    expect(prisma.hashtagHourlyCount.groupBy).toHaveBeenCalledTimes(2);
    trends.invalidate();
    await trends.rank(input, now);
    expect(prisma.hashtagHourlyCount.groupBy).toHaveBeenCalledTimes(4);
  });

  it("disables percentage and trends when baseline metadata is missing", async () => {
    const { trends, prisma } = factory({
      meta: meta.filter((x) => !x.key.startsWith("hashtagStats")),
    });
    const requested = { period: "24h" as const, mode: "trending" as const,
      page: 1, pageSize: 20 };
    const unavailable = await trends.rank(requested, now);
    expect(unavailable.comparisonAvailable).toBe(false);
    expect(unavailable.freshness).toBe("unverified");
    expect(unavailable.items).toEqual([]);
    expect(prisma.hashtagHourlyCount.groupBy).toHaveBeenCalledTimes(1);
    const most = await trends.rank({ ...requested, mode: "most-cited" }, now);
    expect(most.items[0]?.changeLabel).toBe("—");
    expect(most.items[0]?.changePercent).toBeNull();
  });

  it("requires 60 retention days for a 30d/30d comparison", async () => {
    const short = meta.map((r) => r.key === "retentionArticlesDays" ? {
      ...r, value: "45",
    } : r);
    const { trends } = factory({ meta: short });
    const result = await trends.rank({ period: "30d", mode: "trending",
      page: 1, pageSize: 20 }, now);
    expect(result.comparisonAvailable).toBe(false);
    expect(result.comparisonReason).toContain("conservation insuffisante");
    expect(result.items).toEqual([]);
  });

  it("flags a stale reconstruction rather than claiming a valid comparison", async () => {
    const old = meta.map((r) => r.key === "hashtagStatsLastFullRebuildAt"
      ? { ...r, value: "2026-10-11T00:00:00.000Z" } : r);
    const { trends } = factory({ meta: old });
    const result = await trends.rank({ period: "24h", mode: "trending",
      page: 1, pageSize: 20 }, now);
    expect(result.freshness).toBe("stale");
    expect(result.comparisonAvailable).toBe(false);
  });
});

describe("SCRUM-53 — persisted admin thresholds", () => {
  it("rejects missing seed values and invalid persisted types", async () => {
    const { trends } = factory({ settings: settings.slice(0, 2) });
    await expect(trends.getSettings()).rejects.toThrow(ServiceUnavailableException);
  });

  it("rejects zero, fractions and negative parameters", async () => {
    const { trends, prisma } = factory();
    await expect(trends.updateSettings({
      hashtagTrendMinMentions: 0,
      hashtagTrendMinIncrease: 5,
      hashtagTrendScoreFloor: 5,
    })).rejects.toThrow(BadRequestException);
    await expect(trends.updateSettings({
      hashtagTrendMinMentions: 10.5,
      hashtagTrendMinIncrease: 5,
      hashtagTrendScoreFloor: 5,
    })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates all three existing settings in one transaction", async () => {
    const { trends, prisma } = factory();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (
      callback: (tx: { setting: {
        findMany: typeof prisma.setting.findMany; updateMany: typeof updateMany } }) => Promise<unknown>,
    ) => callback({ setting: { findMany: prisma.setting.findMany, updateMany } }));
    const result = await trends.updateSettings({
      hashtagTrendMinMentions: 12, hashtagTrendMinIncrease: 7, hashtagTrendScoreFloor: 8,
    });
    expect(updateMany).toHaveBeenCalledTimes(3);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "hashtagTrendMinMentions", scope: "GLOBAL", scopeId: null, type: "INTEGER" },
      data: { value: "12" },
    }));
    // The mocked read does not persist writes; it proves atomic writes and
    // return readback instead of assuming the supplied values were saved.
    expect(result.hashtagTrendMinMentions).toBe(10);
  });
});
