import { compileHashtags } from "@lmn24/contracts";
import {
  collectHashtagHours, insertArticlesAndCount, rebuildHashtagHourlyCounts,
  startOfUtcHour,
} from "@lmn24/database";
import { describe, expect, it, vi } from "vitest";

const timestamp = new Date("2026-10-13T14:37:00Z");
const now = new Date("2026-10-14T08:00:00Z");
const subject = { id: "moscow", name: "Moscou", aliases: [{ name: "Moscow" }, { name: "Москва" }] };
const article = { id: "a", title: "Moscou", summary: "Moscow et Москва", publishedAt: timestamp };

describe("SCRUM-52 — UTC buckets and distinct articles", () => {
  it("buckets by original publication hour, not processing time", () => {
    expect(startOfUtcHour(timestamp).toISOString()).toBe("2026-10-13T14:00:00.000Z");
    const map = new Map<string, { hashtagId: string; hourUtc: Date; articleCount: number }>();
    const hits = collectHashtagHours(
      [article, { id: "b", title: "Other", summary: null, publishedAt: timestamp }],
      compileHashtags([subject]), map, new Date("2026-10-13T00:00:00Z"), now,
    );
    expect(hits).toBe(1);
    expect([...map.values()]).toMatchObject([{ hashtagId: "moscow", articleCount: 1 }]);
  });

  it("updates a unique counter inside the very same insert transaction", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: 1 }]),
      setting: { findMany: vi.fn().mockResolvedValue([]) },
      hashtag: { findMany: vi.fn().mockResolvedValue([subject]) },
      article: { createManyAndReturn: vi.fn().mockResolvedValue([article]) },
      hashtagHourlyCount: { upsert },
    };
    const db = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    await expect(insertArticlesAndCount(db as never, [{
      sourceId: "s", categoryId: "c", languageIsoCode2: "fr",
      title: article.title, summary: article.summary,
      articleUrl: "https://example.org/a", publishedAt: timestamp,
    }], now)).resolves.toEqual({ imported: 1, matched: 1 });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { hashtagId_hourUtc: { hashtagId: "moscow", hourUtc: startOfUtcHour(timestamp) } },
      create: { hashtagId: "moscow", hourUtc: startOfUtcHour(timestamp), articleCount: 1 },
      update: { articleCount: { increment: 1 } },
    }));
  });

  it("does not persist a counter if the article was deduplicated", async () => {
    const upsert = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: 1 }]),
      setting: { findMany: vi.fn().mockResolvedValue([]) },
      hashtag: { findMany: vi.fn().mockResolvedValue([subject]) },
      article: { createManyAndReturn: vi.fn().mockResolvedValue([]) },
      hashtagHourlyCount: { upsert },
    };
    const db = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const result = await insertArticlesAndCount(db as never, [{
      sourceId: "s", categoryId: "c", languageIsoCode2: "fr", title: "Moscou",
      articleUrl: "https://example.org/a", publishedAt: timestamp,
    }], now);
    expect(result).toEqual({ imported: 0, matched: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("SCRUM-52 — complete / targeted and idempotent reconciliation", () => {
  function fakeDb() {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: 1 }]),
      setting: { findMany: vi.fn().mockResolvedValue([
        { key: "retentionArticlesDays", value: "60" },
        { key: "retentionHashtagHourlyCountsDays", value: "60" },
      ]) },
      hashtag: { findMany: vi.fn().mockResolvedValue([subject]) },
      article: { findMany: vi.fn().mockResolvedValueOnce([article]).mockResolvedValue([]) },
      hashtagHourlyCount: { deleteMany, createMany },
    };
    const db = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    return { db, tx };
  }

  it("replaces counts from retained articles atomically and removes ghosts", async () => {
    const { db, tx } = fakeDb();
    const stats = await rebuildHashtagHourlyCounts(db as never, {}, now);
    expect(stats).toMatchObject({ scannedArticles: 1, matchingArticles: 1, countedBuckets: 1 });
    expect(tx.hashtagHourlyCount.deleteMany).toHaveBeenCalledWith({ where: {} });
    expect(tx.hashtagHourlyCount.createMany).toHaveBeenCalledWith({
      data: [{ hashtagId: "moscow", hourUtc: startOfUtcHour(timestamp), articleCount: 1 }],
    });
  });

  it("rebuilds only the specified hashtag, not unrelated subjects", async () => {
    const { db, tx } = fakeDb();
    const stats = await rebuildHashtagHourlyCounts(db as never, { hashtagId: "moscow" }, now);
    expect(stats.hashtagId).toBe("moscow");
    expect(tx.hashtag.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "moscow" },
    }));
    expect(tx.hashtagHourlyCount.deleteMany).toHaveBeenCalledWith({
      where: { hashtagId: "moscow" },
    });
  });

  it("limits a repair to affected hours and filters expired articles", async () => {
    const { db, tx } = fakeDb();
    await rebuildHashtagHourlyCounts(
      db as never, { from: new Date("2026-10-13T00:00:00Z") }, now,
    );
    expect(tx.hashtagHourlyCount.deleteMany).toHaveBeenCalledWith({
      where: { hourUtc: { gte: new Date("2026-10-13T00:00:00Z"),
        lt: new Date("2026-10-14T09:00:00Z") } },
    });
  });
});
