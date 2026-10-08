import { Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly database: DatabaseService) {}

  async list() {
    return this.database.prisma.category.findMany({
      orderBy: {
        slug: "asc",
      },
      select: {
        id: true,
        slug: true,
        isActive: true,
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const existing = await this.database.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Catégorie introuvable.");
    }

    return this.database.prisma.category.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        slug: true,
        isActive: true,
      },
    });
  }
}
