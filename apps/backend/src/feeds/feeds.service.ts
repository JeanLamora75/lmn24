import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

export type FeedStatusFilter = "all" | "active" | "inactive";

export type ListFeedsParams = {
  search?: string | undefined;
  language?: string | undefined;
  status: FeedStatusFilter;
  page: number;
  pageSize: number;
};

@Injectable()
export class FeedsService {
  constructor(private readonly database: DatabaseService) {}

  async list(params: ListFeedsParams) {
    const search = params.search?.trim();

    const where = {
      ...(search
        ? {
            source: {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          }
        : {}),
      ...(params.language
        ? {
            languageIsoCode2: params.language.trim().toLowerCase(),
          }
        : {}),
      ...(params.status === "active"
        ? { isActive: true }
        : params.status === "inactive"
          ? { isActive: false }
          : {}),
    };

    const total = await this.database.prisma.feed.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const page = Math.min(params.page, totalPages);

    const items = await this.database.prisma.feed.findMany({
      where,
      orderBy: [
        {
          source: {
            name: "asc",
          },
        },
        {
          category: {
            slug: "asc",
          },
        },
        {
          languageIsoCode2: "asc",
        },
        {
          feedUrl: "asc",
        },
        {
          id: "asc",
        },
      ],
      skip: (page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        feedUrl: true,
        isActive: true,
        source: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            slug: true,
          },
        },
        language: {
          select: {
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

  async listLanguages() {
    return this.database.prisma.language.findMany({
      where: {
        feeds: {
          some: {},
        },
      },
      orderBy: {
        isoCode2: "asc",
      },
      select: {
        isoCode2: true,
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const existing = await this.database.prisma.feed.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Flux RSS/XML introuvable.");
    }

    return this.database.prisma.feed.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        isActive: true,
      },
    });
  }
}
