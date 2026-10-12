import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { SourceMediaService } from "./source-media.service";

export type SourceStatusFilter = "all" | "active" | "inactive";

export type ListSourcesParams = {
  search?: string | undefined;
  countryId?: string | undefined;
  status: SourceStatusFilter;
  feedRange?: "all" | "0" | "1-5" | "6-10" | "11+";
  articleRange?: "all" | "0" | "1-25" | "26-100" | "101+";
  missingSocial?: "all" | "x" | "facebook" | "instagram" | "youtube";
  page: number;
  pageSize: number;
};

export type SourceInput = {
  name: string;
  slug: string;
  websiteUrl: string;
  countryIsoCode2: string;
  isActive: boolean;
  logoUrl?: string | null | undefined;
  rssPageUrl?: string | null | undefined;
  facebookUrl?: string | null | undefined;
  xUrl?: string | null | undefined;
  instagramUrl?: string | null | undefined;
  youtubeUrl?: string | null | undefined;
  description?: string | null | undefined;
};

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly media: SourceMediaService,
  ) {}

  async list(params: ListSourcesParams) {
    const search = params.search?.trim();

    // Aggregate over the whole dataset so filtering happens before pagination.
    const rangeIds = async (
      relation: "feed" | "article",
      range: string | undefined,
    ): Promise<string[] | null> => {
      if (!range || range === "all" || range === "0") return null;
      const bounds: Record<string, [number, number | null]> = {
        "1-5": [1, 5], "6-10": [6, 10], "11+": [11, null],
        "1-25": [1, 25], "26-100": [26, 100], "101+": [101, null],
      };
      const [minimum, maximum] = bounds[range] ?? [1, null];
      const groups = relation === "feed"
        ? await this.database.prisma.feed.groupBy({
            by: ["sourceId"],
            _count: { _all: true },
            having: { sourceId: { _count: { gte: minimum, ...(maximum === null ? {} : { lte: maximum }) } } },
          })
        : await this.database.prisma.article.groupBy({
            by: ["sourceId"],
            _count: { _all: true },
            having: { sourceId: { _count: { gte: minimum, ...(maximum === null ? {} : { lte: maximum }) } } },
          });
      return groups.map((group) => group.sourceId);
    };

    // SQL BTRIM ensures whitespace-only legacy URLs are treated as missing.
    const missingSocialIds = async () => {
      switch (params.missingSocial) {
        case "x": return this.database.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM source WHERE NULLIF(BTRIM(x_url), '') IS NULL`;
        case "facebook": return this.database.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM source WHERE NULLIF(BTRIM(facebook_url), '') IS NULL`;
        case "instagram": return this.database.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM source WHERE NULLIF(BTRIM(instagram_url), '') IS NULL`;
        case "youtube": return this.database.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM source WHERE NULLIF(BTRIM(youtube_url), '') IS NULL`;
        default: return null;
      }
    };
    const [feedIds, articleIds, socialIds] = await Promise.all([
      rangeIds("feed", params.feedRange),
      rangeIds("article", params.articleRange),
      missingSocialIds(),
    ]);
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
      AND: [
        ...(params.feedRange === "0" ? [{ feeds: { none: {} } }] : feedIds !== null ? [{ id: { in: feedIds } }] : []),
        ...(params.articleRange === "0" ? [{ articles: { none: {} } }] : articleIds !== null ? [{ id: { in: articleIds } }] : []),
        ...(socialIds !== null ? [{ id: { in: socialIds.map((item) => item.id) } }] : []),
      ],
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
        slug: true,
        websiteUrl: true,
        rssPageUrl: true,
        facebookUrl: true,
        xUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        description: true,
        isActive: true,
        country: {
          select: {
            id: true,
            isoCode2: true,
          },
        },
        _count: { select: { feeds: true, articles: true } },
      },
    });

    return {
      items: items.map(({ _count, ...source }) => ({
        ...source,
        feedCount: _count.feeds,
        articleCount: _count.articles,
      })),
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

  async listFormCountries() {
    return this.database.prisma.country.findMany({
      where: {
        isActive: true,
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

  async getById(id: string) {
    const source = await this.database.prisma.source.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        websiteUrl: true,
        logoUrl: true,
        rssPageUrl: true,
        facebookUrl: true,
        xUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        description: true,
        country: {
          select: {
            isoCode2: true,
          },
        },
        isActive: true,
      },
    });

    if (!source) {
      throw new NotFoundException("Source introuvable.");
    }

    return {
      id: source.id,
      name: source.name,
      slug: source.slug,
      websiteUrl: source.websiteUrl,
      logoUrl: source.logoUrl,
      rssPageUrl: source.rssPageUrl,
      facebookUrl: source.facebookUrl,
      xUrl: source.xUrl,
      instagramUrl: source.instagramUrl,
      youtubeUrl: source.youtubeUrl,
      description: source.description,
      countryIsoCode2: source.country.isoCode2.trim(),
      isActive: source.isActive,
    };
  }

  async create(input: SourceInput) {
    const countryId = await this.resolveCountryId(input.countryIsoCode2);
    await this.assertSlugAvailable(input.slug);

    return this.database.prisma.source.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        websiteUrl: input.websiteUrl.trim(),
        countryId,
        isActive: input.isActive,
        logoUrl: input.logoUrl ?? null,
        rssPageUrl: input.rssPageUrl ?? null,
        facebookUrl: input.facebookUrl ?? null,
        xUrl: input.xUrl ?? null,
        instagramUrl: input.instagramUrl ?? null,
        youtubeUrl: input.youtubeUrl ?? null,
        description: input.description ?? null,
      },
      select: {
        id: true,
      },
    });
  }

  async update(id: string, input: SourceInput) {
    const existing = await this.database.prisma.source.findUnique({
      where: { id },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    if (!existing) {
      throw new NotFoundException("Source introuvable.");
    }

    const countryId = await this.resolveCountryId(input.countryIsoCode2);
    await this.assertSlugAvailable(input.slug, id);

    const updated = await this.database.prisma.source.update({
      where: { id },
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        websiteUrl: input.websiteUrl.trim(),
        countryId,
        isActive: input.isActive,
        logoUrl: input.logoUrl ?? null,
        ...(input.rssPageUrl !== undefined ? { rssPageUrl: input.rssPageUrl } : {}),
        ...(input.facebookUrl !== undefined ? { facebookUrl: input.facebookUrl } : {}),
        ...(input.xUrl !== undefined ? { xUrl: input.xUrl } : {}),
        ...(input.instagramUrl !== undefined ? { instagramUrl: input.instagramUrl } : {}),
        ...(input.youtubeUrl !== undefined ? { youtubeUrl: input.youtubeUrl } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      select: {
        id: true,
      },
    });

    if (
      existing.logoUrl &&
      existing.logoUrl !== input.logoUrl &&
      this.media.isManagedLogoUrl(existing.logoUrl)
    ) {
      await this.media.deleteLocalImage(existing.logoUrl);
    }

    return updated;
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

  async getDeleteImpact(id: string) {
    const source = await this.database.prisma.source.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!source) {
      throw new NotFoundException("Source introuvable.");
    }

    const [feeds, articles] = await Promise.all([
      this.database.prisma.feed.count({
        where: { sourceId: id },
      }),
      this.database.prisma.article.count({
        where: { sourceId: id },
      }),
    ]);

    return {
      feeds,
      articles,
    };
  }

  async delete(id: string) {
    const result = await this.database.prisma.$transaction(async (tx) => {
      const source = await tx.source.findUnique({
        where: { id },
        select: {
          id: true,
          logoUrl: true,
        },
      });

      if (!source) {
        throw new NotFoundException("Source introuvable.");
      }

      const feeds = await tx.feed.findMany({
        where: { sourceId: id },
        select: { id: true },
      });

      const feedIds = feeds.map((feed) => feed.id);

      if (feedIds.length > 0) {
        await tx.feedRun.deleteMany({
          where: {
            feedId: {
              in: feedIds,
            },
          },
        });
      }

      const deletedFeeds = await tx.feed.deleteMany({
        where: { sourceId: id },
      });

      const deletedArticles = await tx.article.deleteMany({
        where: { sourceId: id },
      });

      await tx.source.delete({
        where: { id },
      });

      return {
        logoUrl: source.logoUrl,
        feeds: deletedFeeds.count,
        articles: deletedArticles.count,
      };
    });

    if (result.logoUrl) {
      try {
        await this.media.deleteLocalImage(result.logoUrl);
      } catch {
        // La suppression transactionnelle a déjà réussi : ne pas annoncer un échec trompeur.
        this.logger.warn("Source supprimée, mais son logo local n'a pas pu être effacé.");
      }
    }

    return {
      feeds: result.feeds,
      articles: result.articles,
    };
  }

  private async resolveCountryId(isoCode2: string): Promise<string> {
    const country = await this.database.prisma.country.findUnique({
      where: {
        isoCode2: isoCode2.trim().toUpperCase(),
      },
      select: {
        id: true,
      },
    });

    if (!country) {
      throw new BadRequestException(
        "Le pays sélectionné n’existe pas dans la base LMN24.",
      );
    }

    return country.id;
  }

  private async assertSlugAvailable(
    slug: string,
    currentId?: string,
  ): Promise<void> {
    const existing = await this.database.prisma.source.findFirst({
      where: {
        slug: slug.trim(),
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
      throw new ConflictException("Ce slug est déjà utilisé.");
    }
  }
}
