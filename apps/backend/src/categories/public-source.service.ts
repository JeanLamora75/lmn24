import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CATEGORY_INITIAL_PAGE_SIZE, CATEGORY_MAX_PAGE_SIZE } from "@lmn24/contracts";

import { DatabaseService } from "../database/database.service";
import { decodeCategoryCursor, encodeCategoryCursor } from "./public-category.service";
import type { PublicHomeArticle } from "./public-home.service";

export type PublicSourceResponse = {
  source: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    description: string | null;
    facebookUrl: string | null;
    xUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
  };
  items: PublicHomeArticle[];
  hasMore: boolean;
  nextCursor: string | null;
};

@Injectable()
export class PublicSourceService {
  constructor(private readonly database: DatabaseService) {}

  async getArticles(
    slug: string,
    locale: string,
    rawCursor?: string,
    limit = CATEGORY_INITIAL_PAGE_SIZE,
  ): Promise<PublicSourceResponse> {
    if (!Number.isInteger(limit) || limit < 1 || limit > CATEGORY_MAX_PAGE_SIZE) {
      throw new BadRequestException("Taille de page invalide.");
    }
    const cursor = rawCursor ? decodeCategoryCursor(rawCursor) : null;
    const source = await this.database.prisma.source.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        logoUrl: true,
        description: true,
        facebookUrl: true,
        xUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
      },
    });
    if (!source?.isActive) {
      throw new NotFoundException("Source introuvable.");
    }

    const rows = await this.database.prisma.article.findMany({
      where: {
        sourceId: source.id,
        languageIsoCode2: locale,
        ...(cursor ? {
          OR: [
            { publishedAt: { lt: cursor.publishedAt } },
            { publishedAt: cursor.publishedAt, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        summary: true,
        imageUrl: true,
        articleUrl: true,
        publishedAt: true,
        source: {
          select: {
            name: true,
            logoUrl: true,
            country: { select: { isoCode2: true } },
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        logoUrl: source.logoUrl,
        description: source.description,
        facebookUrl: source.facebookUrl,
        xUrl: source.xUrl,
        instagramUrl: source.instagramUrl,
        youtubeUrl: source.youtubeUrl,
      },
      items: page.map(row => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        imageUrl: row.imageUrl,
        articleUrl: row.articleUrl,
        publishedAt: row.publishedAt,
        source: {
          name: row.source.name,
          logoUrl: row.source.logoUrl,
          countryIsoCode2: row.source.country.isoCode2,
        },
      })),
      hasMore,
      nextCursor: hasMore && last
        ? encodeCategoryCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
    };
  }
}
