import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { PublicSourceController } from "./public-source.controller";
import { PublicSourceService } from "./public-source.service";

const sourceId = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(n).padStart(12, "0");
const baseSource = {
  id: sourceId,
  slug: "le-monde",
  name: "Le Monde",
  isActive: true,
  logoUrl: "https://example.org/logo.png",
  description: "Un journal national",
  facebookUrl: "https://facebook.com/lemonde",
  xUrl: "https://x.com/lemonde",
  instagramUrl: null,
  youtubeUrl: null,
};

const fixture = Array.from({ length: 54 }, (_, i) => ({
  id: id(i),
  title: "Titre " + i,
  summary: "Résumé " + i,
  imageUrl: null,
  articleUrl: "https://example.org/" + i,
  publishedAt: new Date(Date.UTC(2026, 9, 10) - i * 60_000),
  source: {
    name: "Le Monde",
    logoUrl: null,
    country: { isoCode2: "FR" },
  },
}));

describe("SCRUM-32 — API publique d'une source", () => {
  it("filtre les articles par identifiant de source et langue, sans dépendre des flux", async () => {
    const findUnique = vi.fn().mockResolvedValue(baseSource);
    const findMany = vi.fn().mockResolvedValue(fixture.slice(0, 20));
    const service = new PublicSourceService({
      prisma: { source: { findUnique }, article: { findMany } },
    } as unknown as DatabaseService);
    const result = await service.getArticles("le-monde", "fr");
    expect(result.source).not.toHaveProperty("isActive");
    expect(result.source).toMatchObject({
      slug: "le-monde", name: "Le Monde", description: "Un journal national",
      facebookUrl: "https://facebook.com/lemonde",
    });
    expect(result.items).toHaveLength(19);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { sourceId, languageIsoCode2: "fr" },
      take: 20,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: {
        source: { select: { country: { select: { isoCode2: true } } } },
      },
    });
  });

  it("parcourt plusieurs pages de manière stable sans doublons", async () => {
    const findMany = vi.fn().mockImplementation(async ({ where, take }) => {
      const date = where.OR?.[0]?.publishedAt?.lt as Date | undefined;
      const rows = date
        ? fixture.filter(row => row.publishedAt < date ||
            (row.publishedAt.getTime() === date.getTime() &&
              row.id < where.OR[1].id.lt))
        : fixture;
      return rows.slice(0, take);
    });
    const service = new PublicSourceService({
      prisma: {
        source: { findUnique: vi.fn().mockResolvedValue(baseSource) },
        article: { findMany },
      },
    } as unknown as DatabaseService);
    let cursor: string | undefined;
    const articleIds: string[] = [];
    for (let iteration = 0; iteration < 12; iteration++) {
      const result = await service.getArticles("le-monde", "nl", cursor, cursor ? 14 : 19);
      articleIds.push(...result.items.map(article => article.id));
      if (!result.hasMore) break;
      cursor = result.nextCursor ?? undefined;
    }
    expect(articleIds).toEqual(fixture.map(row => row.id));
    expect(new Set(articleIds).size).toBe(fixture.length);
    expect(findMany.mock.calls[0]?.[0].where.languageIsoCode2).toBe("nl");
    expect(findMany).toHaveBeenCalledTimes(4);
    await expect(service.getArticles("le-monde", "nl", "not a cursor"))
      .rejects.toThrow(BadRequestException);
  });

  it("renvoie 404 pour une source absente ou inactive", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...baseSource, isActive: false });
    const article = { findMany: vi.fn() };
    const service = new PublicSourceService({
      prisma: { source: { findUnique }, article },
    } as unknown as DatabaseService);
    await expect(service.getArticles("inconnue", "fr")).rejects.toThrow(NotFoundException);
    await expect(service.getArticles("le-monde", "fr")).rejects.toThrow(NotFoundException);
    expect(article.findMany).not.toHaveBeenCalled();
  });

  it("une source active sans articles reste consultable", async () => {
    const service = new PublicSourceService({
      prisma: {
        source: { findUnique: vi.fn().mockResolvedValue(baseSource) },
        article: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as DatabaseService);
    await expect(service.getArticles("le-monde", "fr")).resolves.toMatchObject({
      items: [], hasMore: false, nextCursor: null,
    });
  });

  it("valide les slugs, langues et limites côté contrôleur", async () => {
    const getArticles = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const controller = new PublicSourceController({
      getArticles,
    } as unknown as PublicSourceService);
    await expect(controller.list("Le-Monde", "fr")).rejects.toThrow(BadRequestException);
    await expect(controller.list("le-monde", "xx")).rejects.toThrow(BadRequestException);
    await expect(controller.list("le-monde", "fr", undefined, "10000")).rejects.toThrow(BadRequestException);
    await expect(controller.list("le-monde", "fr", "x".repeat(300))).rejects.toThrow(BadRequestException);
    await controller.list("le-monde", "nl", undefined, "14");
    expect(getArticles).toHaveBeenCalledWith("le-monde", "nl", undefined, 14);
  });
});
