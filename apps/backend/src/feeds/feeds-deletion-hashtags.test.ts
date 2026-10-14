import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { FeedsService } from "./feeds.service";

const id = "55555555-5555-4555-8555-555555555555";

function fixture(running = 0) {
  const tx = {
    feed: {
      findUnique: vi.fn().mockResolvedValue({ id }),
      delete: vi.fn().mockResolvedValue({ id }),
    },
    feedRun: {
      count: vi.fn().mockResolvedValue(running),
      deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
    },
    article: { deleteMany: vi.fn() },
    hashtagHourlyCount: { deleteMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (v: typeof tx) => Promise<unknown>) => callback(tx)),
    feed: { findUnique: vi.fn().mockResolvedValue({ id }) },
    feedRun: { count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(running) },
  };
  return { service: new FeedsService({ prisma } as unknown as DatabaseService), tx, prisma };
}
describe("RSS deletion and hashtag statistics", () => {
  it("confirms that deleting a feed preserves articles and leaves hashtag counters intact", async () => {
    const { service, tx } = fixture();
    await expect(service.delete(id)).resolves.toEqual({ feedRuns: 4 });
    expect(tx.feedRun.deleteMany).toHaveBeenCalledWith({ where: { feedId: id } });
    expect(tx.feed.delete).toHaveBeenCalledWith({ where: { id } });
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
    expect(tx.hashtagHourlyCount.deleteMany).not.toHaveBeenCalled();
  });

  it("protects an active parser from feed deletion", async () => {
    const { service, tx } = fixture(1);
    await expect(service.delete(id)).rejects.toThrow(ConflictException);
    expect(tx.feedRun.deleteMany).not.toHaveBeenCalled();
    expect(tx.feed.delete).not.toHaveBeenCalled();
  });

  it("returns the count of running runs in preview", async () => {
    const { service } = fixture(1);
    await expect(service.getDeleteImpact(id)).resolves.toEqual({
      feedRuns: 4, activeRuns: 1, articlesPreserved: true,
    });
  });

  it("rejects a feed that no longer exists", async () => {
    const { service, tx } = fixture();
    tx.feed.findUnique.mockResolvedValue(null);
    await expect(service.delete(id)).rejects.toThrow(NotFoundException);
    expect(tx.feed.delete).not.toHaveBeenCalled();
  });
});
