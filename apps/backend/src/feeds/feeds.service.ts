import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

export type FeedStatusFilter = "all" | "active" | "inactive";

export type ListFeedsParams = {
  search?: string | undefined;
  sourceId?: string | undefined;
  language?: string | undefined;
  categoryId?: string | undefined;
  status: FeedStatusFilter;
  page: number;
  pageSize: number;
};

export type FeedInput = {
  sourceId: string;
  categoryId: string;
  languageIsoCode2: string;
  feedUrl: string;
  isActive: boolean;
};

@Injectable()
export class FeedsService {
  constructor(private readonly database: DatabaseService) {}

  async list(params: ListFeedsParams) {
    const search = params.search?.trim();

    const where = {
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
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
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
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
        runs: {
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          take: 1,
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

    return {
      items: items.map(({ runs, ...feed }) => ({
        ...feed,
        lastRun: runs[0] ?? null,
      })),
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

  async listCategories() {
    return this.database.prisma.category.findMany({
      orderBy: [{ slug: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
      },
    });
  }

  async exportActiveCsv(): Promise<string> {
    const feeds = await this.database.prisma.feed.findMany({
      where: {
        isActive: true,
      },
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
      select: {
        feedUrl: true,
        source: {
          select: {
            name: true,
            slug: true,
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

    const header =
      "sourceName,sourceSlug,category,language,feedUrl";

    const rows = feeds.map((feed) =>
      [
        feed.source.name,
        feed.source.slug,
        feed.category.slug,
        feed.language.isoCode2.trim().toLowerCase(),
        feed.feedUrl,
      ]
        .map((value) => this.escapeCsv(value))
        .join(","),
    );

    return [header, ...rows].join("\r\n") + "\r\n";
  }

  async listFormOptions() {
    const [sources, categories, languages] = await Promise.all([
      this.database.prisma.source.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          websiteUrl: true,
        },
      }),
      this.database.prisma.category.findMany({
        orderBy: [{ slug: "asc" }, { id: "asc" }],
        select: {
          id: true,
          slug: true,
        },
      }),
      this.database.prisma.language.findMany({
        orderBy: {
          isoCode2: "asc",
        },
        select: {
          isoCode2: true,
        },
      }),
    ]);

    return {
      sources,
      categories,
      languages,
    };
  }

  async getById(id: string) {
    const feed = await this.database.prisma.feed.findUnique({
      where: { id },
      select: {
        id: true,
        sourceId: true,
        categoryId: true,
        languageIsoCode2: true,
        feedUrl: true,
        isActive: true,
      },
    });

    if (!feed) {
      throw new NotFoundException("Flux RSS/XML introuvable.");
    }

    return {
      ...feed,
      languageIsoCode2: feed.languageIsoCode2.trim().toLowerCase(),
    };
  }

  async create(input: FeedInput) {
    await this.assertReferencesExist(input);
    await this.assertFeedUrlAvailable(input.feedUrl);

    return this.database.prisma.feed.create({
      data: {
        sourceId: input.sourceId,
        categoryId: input.categoryId,
        languageIsoCode2: input.languageIsoCode2.trim().toLowerCase(),
        feedUrl: input.feedUrl.trim(),
        isActive: input.isActive,
      },
      select: {
        id: true,
      },
    });
  }

  async update(id: string, input: FeedInput) {
    const existing = await this.database.prisma.feed.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Flux RSS/XML introuvable.");
    }

    await this.assertReferencesExist(input);
    await this.assertFeedUrlAvailable(input.feedUrl, id);

    return this.database.prisma.feed.update({
      where: { id },
      data: {
        sourceId: input.sourceId,
        categoryId: input.categoryId,
        languageIsoCode2: input.languageIsoCode2.trim().toLowerCase(),
        feedUrl: input.feedUrl.trim(),
        isActive: input.isActive,
      },
      select: {
        id: true,
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

  async getDeleteImpact(id: string) {
    const feed = await this.database.prisma.feed.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!feed) {
      throw new NotFoundException("Flux RSS/XML introuvable.");
    }

    const feedRuns = await this.database.prisma.feedRun.count({
      where: {
        feedId: id,
      },
    });

    return {
      feedRuns,
    };
  }

  async delete(id: string) {
    return this.database.prisma.$transaction(async (tx) => {
      const feed = await tx.feed.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!feed) {
        throw new NotFoundException("Flux RSS/XML introuvable.");
      }

      const deletedRuns = await tx.feedRun.deleteMany({
        where: {
          feedId: id,
        },
      });

      await tx.feed.delete({
        where: { id },
      });

      return {
        feedRuns: deletedRuns.count,
      };
    });
  }

  private escapeCsv(value: string): string {
    if (!/[",\r\n]/.test(value)) {
      return value;
    }

    return '"' + value.replace(/"/g, '""') + '"';
  }

  private async assertReferencesExist(input: FeedInput): Promise<void> {
    const languageIsoCode2 = input.languageIsoCode2.trim().toLowerCase();

    const [source, category, language] = await Promise.all([
      this.database.prisma.source.findUnique({
        where: { id: input.sourceId },
        select: { id: true },
      }),
      this.database.prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      }),
      this.database.prisma.language.findUnique({
        where: { isoCode2: languageIsoCode2 },
        select: { isoCode2: true },
      }),
    ]);

    if (!source) {
      throw new BadRequestException("La source sélectionnée n’existe pas.");
    }

    if (!category) {
      throw new BadRequestException("La catégorie sélectionnée n’existe pas.");
    }

    if (!language) {
      throw new BadRequestException("La langue sélectionnée n’existe pas.");
    }
  }

  private async assertFeedUrlAvailable(
    feedUrl: string,
    currentId?: string,
  ): Promise<void> {
    const existing = await this.database.prisma.feed.findFirst({
      where: {
        feedUrl: feedUrl.trim(),
        ...(currentId
          ? {
              id: {
                not: currentId,
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Cette URL de flux est déjà utilisée.");
    }
  }
}
