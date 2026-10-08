import { Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

export type SourceStatusFilter = "all" | "active" | "inactive";

export type ListSourcesParams = {
  search?: string | undefined;
  countryId?: string | undefined;
  status: SourceStatusFilter;
  page: number;
  pageSize: number;
};

@Injectable()
export class SourcesService {
  constructor(private readonly database: DatabaseService) {}

  async list(params: ListSourcesParams) {
    const search = params.search?.trim();

    const where = {
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(params.countryId ? { countryId: params.countryId } : {}),
      ...(params.status === "active"
        ? { isActive: true }
        : params.status === "inactive"
          ? { isActive: false }
          : {}),
    };

    const total = await this.database.prisma.source.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const page = Math.min(params.page, totalPages);

    const items = await this.database.prisma.source.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        isActive: true,
        country: {
          select: {
            id: true,
            isoCode2: true,
          },
        },
      },
    });

    return {
      items,
      pagination: {
        page,
        pageSize: params.pageSize,
        total,
        totalPages: total === 0 ? 0 : totalPages,
      },
    };
  }

  async listCountries() {
    return this.database.prisma.country.findMany({
      where: {
        sources: {
          some: {},
        },
      },
      orderBy: {
        isoCode2: "asc",
      },
      select: {
        id: true,
        isoCode2: true,
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const existing = await this.database.prisma.source.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Source introuvable.");
    }

    return this.database.prisma.source.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        isActive: true,
      },
    });
  }
}
