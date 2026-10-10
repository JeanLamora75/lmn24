import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { FeedsService } from "./feeds.service";

const FEED_ID = "11111111-1111-4111-8111-111111111111";

function createService(prisma: unknown) {
  return new FeedsService({ prisma } as DatabaseService);
}

describe("SCRUM-20 — indicateurs de la dernière exécution", () => {
  it("charge le seul FeedRun le plus récent pour chaque flux déjà paginé", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: FEED_ID,
        feedUrl: "https://example.org/rss",
        isActive: true,
        source: { name: "Exemple" },
        category: { slug: "news" },
        language: { isoCode2: "fr" },
        runs: [{
          startedAt: new Date("2026-10-10T13:00:00Z"),
          durationMs: 1200,
          itemsFound: 14,
          articlesImported: 8,
          status: "SUCCESS",
          errorMessage: null,
        }],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        feedUrl: "https://example.org/rss2",
        isActive: true,
        source: { name: "Exemple" },
        category: { slug: "news" },
        language: { isoCode2: "fr" },
        runs: [],
      },
    ]);
    const count = vi.fn().mockResolvedValue(2);
    const svc = createService({ feed: { count, findMany } });
    const result = await svc.list({ status: "all", page: 1, pageSize: 10 });
    expect(result.items[0]?.lastRun).toMatchObject({
      itemsFound: 14, articlesImported: 8, status: "SUCCESS",
    });
    expect(result.items[1]?.lastRun).toBeNull();
    expect(result.items[0]).not.toHaveProperty("runs");
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      skip: 0,
      take: 10,
      select: {
        runs: {
          take: 1,
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          select: {
            startedAt: true,
            durationMs: true,
            itemsFound: true,
            articlesImported: true,
            status: true,
            errorMessage: true,
          },
        },
      },
    });
  });

  it("récupère un ERROR et son message au lieu de masquer l'échec", async () => {
    const svc = createService({
      feed: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{
          id: FEED_ID,
          runs: [{
            startedAt: new Date("2026-10-10T13:00:00Z"),
            durationMs: 2000,
            itemsFound: 0,
            articlesImported: 0,
            status: "ERROR",
            errorMessage: "HTTP 503",
          }],
        }]),
      },
    });
    const result = await svc.list({ status: "all", page: 1, pageSize: 10 });
    expect(result.items[0]?.lastRun).toMatchObject({
      status: "ERROR",
      errorMessage: "HTTP 503",
      itemsFound: 0,
      articlesImported: 0,
    });
  });
});

describe("SCRUM-20 — suppression depuis la liste", () => {
  it("prévisualise le nombre exact de runs à supprimer", async () => {
    const count = vi.fn().mockResolvedValue(17);
    const svc = createService({
      feed: { findUnique: vi.fn().mockResolvedValue({ id: FEED_ID }) },
      feedRun: { count },
    });
    await expect(svc.getDeleteImpact(FEED_ID)).resolves.toEqual({ feedRuns: 17 });
    expect(count).toHaveBeenCalledWith({ where: { feedId: FEED_ID } });
  });

  it("supprime les historiques puis le flux, sans toucher aux articles", async () => {
    const order: string[] = [];
    const tx = {
      feed: {
        findUnique: vi.fn().mockResolvedValue({ id: FEED_ID }),
        delete: vi.fn().mockImplementation(async () => { order.push("feed"); }),
      },
      feedRun: {
        deleteMany: vi.fn().mockImplementation(async () => {
          order.push("runs");
          return { count: 2 };
        }),
      },
      article: { deleteMany: vi.fn() },
    };
    const transaction = vi.fn().mockImplementation(async callback => callback(tx));
    const svc = createService({ $transaction: transaction });
    await expect(svc.delete(FEED_ID)).resolves.toEqual({ feedRuns: 2 });
    expect(order).toEqual(["runs", "feed"]);
    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
    expect(tx.feedRun.deleteMany).toHaveBeenCalledWith({ where: { feedId: FEED_ID } });
  });

  it("refuse une suppression si le flux n'existe plus", async () => {
    const svc = createService({
      $transaction: vi.fn().mockImplementation(async callback =>
        callback({ feed: { findUnique: vi.fn().mockResolvedValue(null) } }),
      ),
    });
    await expect(svc.delete(FEED_ID)).rejects.toThrow(NotFoundException);
  });
});
