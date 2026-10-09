import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CategoryHomeLayout } from "@lmn24/contracts";

import { DatabaseService } from "../database/database.service";

const categoryFields = {
  id: true,
  slug: true,
  isActive: true,
  displayOrder: true,
  layoutType: true,
  themeColor: true,
} as const;

// Les scripts SQL de peuplement utilisent le même verrou transactionnel.
// Une future API de création de catégorie devra le prendre également.
const CATEGORY_ORDER_LOCK_FIRST = 241024;
const CATEGORY_ORDER_LOCK_SECOND = 1;

@Injectable()
export class CategoriesService {
  constructor(private readonly database: DatabaseService) {}

  async list() {
    return this.database.prisma.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: categoryFields,
    });
  }

  async getById(id: string) {
    const category = await this.database.prisma.category.findUnique({
      where: { id },
      select: categoryFields,
    });

    if (!category) {
      throw new NotFoundException("Catégorie introuvable.");
    }

    return category;
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.getById(id);

    return this.database.prisma.category.update({
      where: { id },
      data: { isActive },
      select: categoryFields,
    });
  }

  async updateHomeDisplay(
    id: string,
    layoutType: CategoryHomeLayout,
    themeColor: string,
  ) {
    await this.getById(id);

    return this.database.prisma.category.update({
      where: { id },
      data: { layoutType, themeColor },
      select: categoryFields,
    });
  }

  async reorder(
    categoryIds: string[],
    expectedOrder: string[],
  ) {
    return this.database.prisma.$transaction(
      async (tx) => {
        // Sérialise tous les changements de position entre administrateurs.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CATEGORY_ORDER_LOCK_FIRST}, ${CATEGORY_ORDER_LOCK_SECOND})`;

        const current = await tx.category.findMany({
          orderBy: { displayOrder: "asc" },
          select: { id: true, displayOrder: true },
        });
        const currentIds = current.map((item) => item.id);

        // Un ordre lu avant une autre écriture ne doit pas écraser le nouvel ordre.
        if (
          expectedOrder.length !== currentIds.length ||
          expectedOrder.some((id, index) => id !== currentIds[index])
        ) {
          throw new ConflictException(
            "Le classement a changé. Rechargez les catégories avant de réessayer.",
          );
        }

        if (
          categoryIds.length !== currentIds.length ||
          new Set(categoryIds).size !== currentIds.length ||
          categoryIds.some((id) => !currentIds.includes(id))
        ) {
          throw new BadRequestException(
            "Le classement doit contenir une seule fois chaque catégorie.",
          );
        }

        if (categoryIds.every((id, index) => id === currentIds[index])) {
          return this.listWithinTransaction(tx);
        }

        // L'index UNIQUE PostgreSQL est contrôlé à chaque UPDATE.
        // Les positions temporaires (strictement supérieures au maximum)
        // empêchent les conflits lors d'une permutation, même sans
        // contrainte UNIQUE DEFERRABLE.
        const highestOrder = current.reduce(
          (max, item) => Math.max(max, item.displayOrder),
          0,
        );
        if (highestOrder + current.length > 2147483647) {
          throw new ConflictException("Les positions de catégories sont saturées.");
        }

        for (const [index, item] of current.entries()) {
          await tx.category.update({
            where: { id: item.id },
            data: { displayOrder: highestOrder + index + 1 },
          });
        }

        for (const [index, id] of categoryIds.entries()) {
          await tx.category.update({
            where: { id },
            data: { displayOrder: index + 1 },
          });
        }

        return this.listWithinTransaction(tx);
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async listPublicHomeCategories() {
    return this.database.prisma.category.findMany({
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
  }

  private listWithinTransaction(
    tx: Parameters<Parameters<DatabaseService["prisma"]["$transaction"]>[0]>[0],
  ) {
    return tx.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: categoryFields,
    });
  }
}
