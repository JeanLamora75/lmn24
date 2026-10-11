import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { PublicCategoryController } from "./public-category.controller";
import { PublicCategoryService } from "./public-category.service";
import { PublicHomeController } from "./public-home.controller";
import { PublicHomeService } from "./public-home.service";

describe("SCRUM-28 — API publiques en néerlandais", () => {
  it("accepte nl sur l'accueil, sans accepter de code inconnu", async () => {
    const getHome = vi.fn().mockResolvedValue({ items: [] });
    const controller = new PublicHomeController({ getHome } as unknown as PublicHomeService);
    await expect(controller.getHome("nl")).resolves.toEqual({ items: [] });
    expect(getHome).toHaveBeenCalledWith("nl");
    await expect(controller.getHome("xx")).rejects.toThrow(BadRequestException);
  });

  it("accepte nl pour les pages de catégories et les pages suivantes", async () => {
    const getArticles = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const controller = new PublicCategoryController({
      getArticles,
    } as unknown as PublicCategoryService);
    await controller.list("sports", "nl");
    expect(getArticles).toHaveBeenCalledWith("sports", "nl", undefined, 19);
    await expect(controller.list("sports", "zz")).rejects.toThrow(BadRequestException);
  });

  it("filtre réellement les articles d'une catégorie par langue nl", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const category = { id: "11111111-1111-4111-8111-111111111111", slug: "sports", isActive: true, themeColor: "#2563EB" };
    const service = new PublicCategoryService({
      prisma: {
        category: { findUnique: vi.fn().mockResolvedValue(category) },
        article: { findMany },
      },
    } as unknown as DatabaseService);
    await service.getArticles("sports", "nl");
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      categoryId: category.id,
      languageIsoCode2: "nl",
    });
  });
});
