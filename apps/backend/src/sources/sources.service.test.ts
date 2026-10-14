import { ConflictException, NotFoundException } from "@nestjs/common";
import { rebuildHashtagHourlyCounts } from "@lmn24/database";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "../hashtags/hashtag-trends.service";
import { SourceMediaService } from "./source-media.service";
import { SourcesService } from "./sources.service";

vi.mock("@lmn24/database", () => ({
  rebuildHashtagHourlyCounts: vi.fn().mockResolvedValue({ countedBuckets: 5 }),
}));

const sourceId = "11111111-1111-4111-8111-111111111111";
function makeService(
  prisma: unknown,
  media?: { deleteLocalImage: ReturnType<typeof vi.fn> },
  trends?: { invalidate: ReturnType<typeof vi.fn> },
) {
  return new SourcesService(
    { prisma } as DatabaseService,
    (media ?? { deleteLocalImage: vi.fn() }) as unknown as SourceMediaService,
    (trends ?? { invalidate: vi.fn() }) as unknown as HashtagTrendsService,
  );
}

function createTx(articles = 12, runningInfo = 0, runningVideo = 0) {
  const order: string[] = [];
  const action = (name: string, count = 1) =>
    vi.fn().mockImplementation(async () => { order.push(name); return { count }; });
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ acquired: 1 }]),
    source: {
      findUnique: vi.fn().mockResolvedValue({ id: sourceId, logoUrl: null }),
      delete: action("source"),
    },
    feedRun: { count: vi.fn().mockResolvedValue(runningInfo), deleteMany: action("feedRun", 3) },
    feedVideoRun: { count: vi.fn().mockResolvedValue(runningVideo),
      deleteMany: action("feedVideoRun", 2) },
    feed: { deleteMany: action("feed", 1) },
    feedVideo: { deleteMany: action("feedVideo", 2) },
    video: { deleteMany: action("video", 4) },
    article: { deleteMany: action("article", articles) },
    hashtagHourlyCount: { deleteMany: action("hourlyCounts", 5) },
    setting: { deleteMany: action("statsMarkers", 2) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { tx, prisma, order };
}

describe("Sources administration — list counts", () => {
  it("returns RSS/article numbers on the list", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([{
      id: sourceId, name: "Le Journal", websiteUrl: "https://example.org",
      isActive: true, country: { id: "fr", isoCode2: "FR" },
      _count: { feeds: 3, articles: 42 },
    }]);
    const result = await makeService({ source: { count, findMany } })
      .list({ status: "all", page: 1, pageSize: 10 });
    expect(result.items).toMatchObject([{
      id: sourceId, feedCount: 3, articleCount: 42,
    }]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      select: { _count: { select: { feeds: true, articles: true } } },
    });
  });

  it("keeps zero RSS/article counts", async () => {
    const result = await makeService({
      source: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{
          id: sourceId, name: "Empty", websiteUrl: "https://example.org",
          isActive: false, country: { isoCode2: "BE" },
          _count: { feeds: 0, articles: 0 },
        }]),
      },
    }).list({ status: "all", page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({ feedCount: 0, articleCount: 0 });
  });
});

describe("Source deletion — impacts and hashtag coherence", () => {
  it("previews every dependent table and RUNNING parser executions", async () => {
    const get = makeService({
      source: { findUnique: vi.fn().mockResolvedValue({ id: sourceId }) },
      feed: { count: vi.fn().mockResolvedValue(4) },
      article: { count: vi.fn().mockResolvedValue(29) },
      feedVideo: { count: vi.fn().mockResolvedValue(2) },
      video: { count: vi.fn().mockResolvedValue(7) },
      feedRun: { count: vi.fn().mockResolvedValue(1) },
      feedVideoRun: { count: vi.fn().mockResolvedValue(2) },
    });
    await expect(get.getDeleteImpact(sourceId)).resolves.toEqual({
      feeds: 4, articles: 29, videoFeeds: 2, videos: 7, activeRuns: 3,
    });
  });

  it("deletes all source dependants then invalidates counters in the same transaction", async () => {
    const { prisma, tx, order } = createTx();
    const trends = { invalidate: vi.fn() };
    const result = await makeService(prisma, undefined, trends).delete(sourceId);
    expect(result).toEqual({
      feeds: 1, articles: 12, videoFeeds: 2, videos: 4,
      hashtagRebuildRequested: true,
    });
    expect(order).toEqual([
      "feedRun", "feedVideoRun", "feed", "video", "feedVideo",
      "article", "hourlyCounts", "statsMarkers", "source",
    ]);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.feedRun.deleteMany).toHaveBeenCalledWith({
      where: { feed: { sourceId } },
    });
    expect(tx.feedVideoRun.deleteMany).toHaveBeenCalledWith({
      where: { feedVideo: { sourceId } },
    });
    expect(tx.article.deleteMany).toHaveBeenCalledWith({
      where: { sourceId },
    });
    expect(tx.hashtagHourlyCount.deleteMany).toHaveBeenCalledWith({});
    expect(tx.setting.deleteMany).toHaveBeenCalledWith({
      where: { scope: "GLOBAL", key: {
        in: ["hashtagStatsLastFullRebuildAt", "hashtagStatsCoverageSinceUtc"],
      } },
    });
    await vi.waitFor(() => {
      expect(rebuildHashtagHourlyCounts).toHaveBeenCalledWith(prisma);
      expect(trends.invalidate).toHaveBeenCalledTimes(2);
    });
  });

  it("does not touch hashtag counts when a source has no articles", async () => {
    const { prisma, tx } = createTx(0);
    const result = await makeService(prisma).delete(sourceId);
    expect(result.hashtagRebuildRequested).toBe(false);
    expect(tx.hashtagHourlyCount.deleteMany).not.toHaveBeenCalled();
    expect(tx.setting.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses RUNNING jobs before deleting anything", async () => {
    const { prisma, tx } = createTx(10, 1, 0);
    await expect(makeService(prisma).delete(sourceId)).rejects
      .toThrow(ConflictException);
    expect(tx.source.delete).not.toHaveBeenCalled();
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses deleting an unknown source", async () => {
    const { prisma, tx } = createTx();
    tx.source.findUnique.mockResolvedValue(null);
    await expect(makeService(prisma).delete(sourceId)).rejects
      .toThrow(NotFoundException);
    expect(tx.source.delete).not.toHaveBeenCalled();
  });

  it("does not return a misleading error when local logo cleanup fails", async () => {
    const { prisma, tx } = createTx(3);
    tx.source.findUnique.mockResolvedValue({
      id: sourceId, logoUrl: "/source-media/old.png",
    });
    const media = { deleteLocalImage: vi.fn().mockRejectedValue(new Error("EACCES")) };
    await expect(makeService(prisma, media).delete(sourceId)).resolves
      .toMatchObject({ articles: 3, hashtagRebuildRequested: true });
  });
});
