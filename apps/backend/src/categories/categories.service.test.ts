import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { CategoriesService } from "./categories.service";

const categoryA = "11111111-1111-4111-8111-111111111111";
const categoryB = "22222222-2222-4222-8222-222222222222";

function createService() {
  const category = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const tx = {
    category,
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const prisma = {
    category,
    $transaction: vi.fn(async (fn: (arg: typeof tx) => unknown) => fn(tx)),
  };
  const service = new CategoriesService({ prisma } as unknown as DatabaseService);
  return { service, prisma, tx, category };
}

describe("CategoriesService / SCRUM-25", () => {
  it("retourne la liste admin dans l'ordre d'accueil", async () => {
    const { service, category } = createService();
    category.findMany.mockResolvedValue([{ id: categoryA, displayOrder: 1 }]);
    await expect(service.list()).resolves.toHaveLength(1);
    expect(category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { displayOrder: "asc" },
        select: expect.objectContaining({
          displayOrder: true,
          layoutType: true,
          themeColor: true,
        }),
      }),
    );
  });

  it("signale une catégorie introuvable", async () => {
    const { service, category } = createService();
    category.findUnique.mockResolvedValue(null);
    await expect(service.getById(categoryA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("enregistre uniquement la mise en page et la couleur", async () => {
    const { service, category } = createService();
    category.findUnique.mockResolvedValue({ id: categoryA });
    category.update.mockResolvedValue({
      id: categoryA,
      layoutType: "MOSAIC",
      themeColor: "#ABCDEF",
    });
    await service.updateHomeDisplay(categoryA, "MOSAIC", "#ABCDEF");
    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: categoryA },
        data: { layoutType: "MOSAIC", themeColor: "#ABCDEF" },
      }),
    );
  });

  it("met à jour la position en deux passes atomiques sans conflit UNIQUE", async () => {
    const { service, prisma, tx, category } = createService();
    const before = [
      { id: categoryA, displayOrder: 1 },
      { id: categoryB, displayOrder: 2 },
    ];
    const after = [
      { id: categoryB, displayOrder: 1 },
      { id: categoryA, displayOrder: 2 },
    ];
    category.findMany.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    category.update.mockResolvedValue({});
    await expect(
      service.reorder([categoryB, categoryA], [categoryA, categoryB]),
    ).resolves.toEqual(after);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(category.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.displayOrder]))
      .toEqual([
        [categoryA, 3],
        [categoryB, 4],
        [categoryB, 1],
        [categoryA, 2],
      ]);
  });

  it("refuse un ancien classement avec un conflit HTTP 409", async () => {
    const { service, category } = createService();
    category.findMany.mockResolvedValue([
      { id: categoryB, displayOrder: 1 },
      { id: categoryA, displayOrder: 2 },
    ]);
    await expect(
      service.reorder([categoryA, categoryB], [categoryA, categoryB]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(category.update).not.toHaveBeenCalled();
  });

  it("refuse une liste incomplète et les identifiants dupliqués", async () => {
    const { service, category } = createService();
    category.findMany.mockResolvedValue([
      { id: categoryA, displayOrder: 1 },
      { id: categoryB, displayOrder: 2 },
    ]);
    await expect(
      service.reorder([categoryA], [categoryA, categoryB]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reorder([categoryA, categoryA], [categoryA, categoryB]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(category.update).not.toHaveBeenCalled();
  });

  it("ne réécrit rien si l'ordre proposé est identique", async () => {
    const { service, category } = createService();
    category.findMany.mockResolvedValue([
      { id: categoryA, displayOrder: 1 },
      { id: categoryB, displayOrder: 2 },
    ]);
    await service.reorder([categoryA, categoryB], [categoryA, categoryB]);
    expect(category.update).not.toHaveBeenCalled();
  });

  it("n'expose au public que les catégories actives", async () => {
    const { service, category } = createService();
    category.findMany.mockResolvedValue([]);
    await service.listPublicHomeCategories();
    expect(category.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        slug: true,
        displayOrder: true,
        layoutType: true,
        themeColor: true,
      },
    });
  });
});
