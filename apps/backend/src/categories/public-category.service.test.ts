import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { PublicCategoryController } from "./public-category.controller";
import {
  decodeCategoryCursor,
  encodeCategoryCursor,
  PublicCategoryService,
} from "./public-category.service";

const categoryId = "11111111-1111-4111-8111-111111111111";
const id = (index: number) =>
  "aaaaaaaa-aaaa-4aaa-8aaa-" + String(index).padStart(12, "0");

const fixture = Array.from({ length: 125 }, (_, i) => ({
  id: id(i),
  title: "Article " + i,
  summary: null,
  imageUrl: null,
  articleUrl: "https://example.org/" + i,
  publishedAt: new Date(Date.UTC(2026, 9, 10) - i * 60_000),
  source: { name: "Exemple", logoUrl: null },
}));

describe("SCRUM-27 — pagination par curseur", () => {
  it("encode et décode la date et l'identifiant ; rejette les curseurs corrompus", () => {
    const position = { publishedAt: new Date("2026-10-10T10:00:00.000Z"), id: id(1) };
    expect(decodeCategoryCursor(encodeCategoryCursor(position))).toEqual(position);
    expect(() => decodeCategoryCursor("nimportequoi")).toThrow(BadRequestException);
    expect(() => decodeCategoryCursor("invalid!")).toThrow(BadRequestException);
  });

  it("permet de parcourir les 125 articles sans OFFSET, sans doublon et par ordre de publication", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: categoryId, slug: "sports", themeColor: "#198754", isActive: true,
    });
    const findMany = vi.fn().mockImplementation(async ({ where, take }) => {
      expect(where.categoryId).toBe(categoryId);
      expect(where.languageIsoCode2).toBe("fr");
      const position = where.OR?.[0]?.publishedAt?.lt as Date | undefined;
      const rows = position
        ? fixture.filter((article) =>
            article.publishedAt < position ||
            (article.publishedAt.getTime() === position.getTime() &&
              article.id < where.OR[1].id.lt),
          )
        : fixture;
      return rows.slice(0, take);
    });
    const service = new PublicCategoryService({
      prisma: {
        category: { findUnique },
        article: { findMany },
      },
    } as unknown as DatabaseService);
    const ids: string[] = [];
    let cursor: string | undefined;
    let rounds = 0;
    do {
      const page = await service.getArticles("sports", "fr", cursor, cursor ? 14 : 19);
      expect(page.category.themeColor).toBe("#198754");
      ids.push(...page.items.map((article) => article.id));
      cursor = page.nextCursor ?? undefined;
      rounds++;
      if (!page.hasMore) break;
    } while (rounds < 20);
    expect(ids).toEqual(fixture.map((article) => article.id));
    expect(new Set(ids).size).toBe(125);
    expect(findMany).toHaveBeenCalledTimes(9);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 20,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({ take: 15 });
  });

  it("distingue une catégorie inactive d'une catégorie active mais vide", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({
      id: categoryId, slug: "news", isActive: false, themeColor: "#0D6EFD",
    }).mockResolvedValueOnce({
      id: categoryId, slug: "news", isActive: true, themeColor: "#0D6EFD",
    });
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new PublicCategoryService({
      prisma: { category: { findUnique }, article: { findMany } },
    } as unknown as DatabaseService);
    await expect(service.getArticles("news", "en")).rejects.toThrow(NotFoundException);
    await expect(service.getArticles("news", "en")).resolves.toMatchObject({
      items: [], hasMore: false, nextCursor: null,
    });
  });
});

describe("SCRUM-27 — validation des paramètres de l'API", () => {
  it("rejette les langues, tailles de lots et slugs invalides", async () => {
    const getArticles = vi.fn();
    const controller = new PublicCategoryController({
      getArticles,
    } as unknown as PublicCategoryService);
    await expect(controller.list("sports", "xx")).rejects.toThrow(BadRequestException);
    await expect(controller.list("sports", "fr", undefined, "500")).rejects.toThrow(BadRequestException);
    await expect(controller.list("Sports", "fr")).rejects.toThrow(BadRequestException);
    expect(getArticles).not.toHaveBeenCalled();
  });

  it("transmet le filtre strict et les limites au service", async () => {
    const getArticles = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const controller = new PublicCategoryController({
      getArticles,
    } as unknown as PublicCategoryService);
    await controller.list("faits-divers", "de", undefined, "14");
    expect(getArticles).toHaveBeenCalledWith("faits-divers", "de", undefined, 14);
  });
});
