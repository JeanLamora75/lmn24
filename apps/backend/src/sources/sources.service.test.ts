import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { SourceMediaService } from "./source-media.service";
import { SourcesService } from "./sources.service";

const sourceId = "11111111-1111-4111-8111-111111111111";

function service(prisma: unknown, media?: { deleteLocalImage: ReturnType<typeof vi.fn> }) {
  return new SourcesService(
    { prisma } as DatabaseService,
    (media ?? { deleteLocalImage: vi.fn() }) as unknown as SourceMediaService,
  );
}

describe("SCRUM-14 — colonnes et compteurs des sources", () => {
  it("retourne les nombres exacts de flux et d'articles pour chaque ligne paginée", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([{
      id: sourceId,
      name: "Le Journal",
      websiteUrl: "https://example.org",
      isActive: true,
      country: { id: "fr", isoCode2: "FR" },
      _count: { feeds: 3, articles: 42 },
    }]);
    const result = await service({ source: { count, findMany } }).list({
      status: "all", page: 1, pageSize: 10,
    });
    expect(result.items).toMatchObject([{
      id: sourceId, feedCount: 3, articleCount: 42,
      country: { isoCode2: "FR" },
    }]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      select: { _count: { select: { feeds: true, articles: true } } },
    });
  });

  it("affiche également les compteurs à zéro", async () => {
    const result = await service({
      source: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{
          id: sourceId,
          name: "Source vide",
          websiteUrl: "https://example.org",
          isActive: false,
          country: { isoCode2: "BE" },
          _count: { feeds: 0, articles: 0 },
        }]),
      },
    }).list({ status: "all", page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({ feedCount: 0, articleCount: 0 });
  });
});

describe("SCRUM-14 — prévisualisation et suppression transactionnelle", () => {
  it("annonce les dépendances réelles avant la suppression", async () => {
    const get = service({
      source: { findUnique: vi.fn().mockResolvedValue({ id: sourceId }) },
      feed: { count: vi.fn().mockResolvedValue(4) },
      article: { count: vi.fn().mockResolvedValue(29) },
    });
    await expect(get.getDeleteImpact(sourceId)).resolves.toEqual({ feeds: 4, articles: 29 });
  });

  it("supprime les historiques, les flux et les articles avant la source", async () => {
    const order: string[] = [];
    const tx = {
      source: {
        findUnique: vi.fn().mockResolvedValue({ id: sourceId, logoUrl: null }),
        delete: vi.fn().mockImplementation(async () => { order.push("source"); }),
      },
      feed: {
        findMany: vi.fn().mockResolvedValue([{ id: "feed-1" }]),
        deleteMany: vi.fn().mockImplementation(async () => { order.push("feed"); return { count: 1 }; }),
      },
      feedRun: {
        deleteMany: vi.fn().mockImplementation(async () => { order.push("feedRun"); return { count: 3 }; }),
      },
      article: {
        deleteMany: vi.fn().mockImplementation(async () => { order.push("article"); return { count: 12 }; }),
      },
    };
    const prisma = { $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)) };
    const result = await service(prisma).delete(sourceId);
    expect(result).toEqual({ feeds: 1, articles: 12 });
    expect(order).toEqual(["feedRun", "feed", "article", "source"]);
    expect(tx.feedRun.deleteMany).toHaveBeenCalledWith({ where: { feedId: { in: ["feed-1"] } } });
    expect(tx.feed.deleteMany).toHaveBeenCalledWith({ where: { sourceId } });
    expect(tx.article.deleteMany).toHaveBeenCalledWith({ where: { sourceId } });
  });

  it("refuse de supprimer une source inexistante", async () => {
    const tx = { source: { findUnique: vi.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)) };
    await expect(service(prisma).delete(sourceId)).rejects.toThrow(NotFoundException);
  });
  it("n'annonce pas un faux échec si le logo local est verrouillé après la transaction", async () => {
    const tx = {
      source: {
        findUnique: vi.fn().mockResolvedValue({ id: sourceId, logoUrl: "/api/admin/sources/image/old.png" }),
        delete: vi.fn().mockResolvedValue({ id: sourceId }),
      },
      feed: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      article: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const prisma = { $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)) };
    const media = { deleteLocalImage: vi.fn().mockRejectedValue(new Error("EACCES")) };
    await expect(service(prisma, media).delete(sourceId)).resolves.toEqual({
      feeds: 0, articles: 3,
    });
    expect(tx.source.delete).toHaveBeenCalledOnce();
  });

});
