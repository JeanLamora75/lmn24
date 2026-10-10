import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CATEGORY_INITIAL_PAGE_SIZE,
  CATEGORY_MAX_PAGE_SIZE,
} from "@lmn24/contracts";

import { DatabaseService } from "../database/database.service";
import type { PublicHomeArticle } from "./public-home.service";

type CursorPosition = { publishedAt: Date; id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opaque cursor built from both fields used in the database sort order. */
export function encodeCategoryCursor(position: CursorPosition): string {
  return Buffer.from(
    JSON.stringify([position.publishedAt.toISOString(), position.id]),
    "utf8",
  ).toString("base64url");
}

export function decodeCategoryCursor(raw: string): CursorPosition {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(raw)) {
    throw new BadRequestException("Curseur de pagination invalide.");
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string" ||
      !UUID.test(parsed[1]) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed[0])
    ) {
      throw new Error("Invalid cursor structure");
    }
    const date = new Date(parsed[0]);
    if (Number.isNaN(date.getTime()) || date.toISOString() !== parsed[0]) {
      throw new Error("Invalid cursor date");
    }
    return { publishedAt: date, id: parsed[1] };
  } catch {
    throw new BadRequestException("Curseur de pagination invalide.");
  }
}

export type PublicCategoryResponse = {
  category: { id: string; slug: string; themeColor: string };
  items: PublicHomeArticle[];
  nextCursor: string | null;
  hasMore: boolean;
};

@Injectable()
export class PublicCategoryService {
  constructor(private readonly database: DatabaseService) {}

  async getArticles(
    slug: string,
    locale: string,
    rawCursor?: string,
    limit = CATEGORY_INITIAL_PAGE_SIZE,
  ): Promise<PublicCategoryResponse> {
    if (!Number.isInteger(limit) || limit < 1 || limit > CATEGORY_MAX_PAGE_SIZE) {
      throw new BadRequestException("Taille de page invalide.");
    }
    const cursor = rawCursor ? decodeCategoryCursor(rawCursor) : null;
    const category = await this.database.prisma.category.findUnique({
      where: { slug },
      select: { id: true, slug: true, isActive: true, themeColor: true },
    });
    if (!category?.isActive) {
      throw new NotFoundException("Catégorie introuvable.");
    }

    // Pagination keyset, sans OFFSET : un index (language, category, date) existe déjà.
    // Une ligne supplémentaire sert uniquement à détecter la page suivante.
    const rows = await this.database.prisma.article.findMany({
      where: {
        categoryId: category.id,
        languageIsoCode2: locale,
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: cursor.publishedAt } },
                {
                  publishedAt: cursor.publishedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
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
        source: { select: { name: true, logoUrl: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      category: {
        id: category.id,
        slug: category.slug,
        themeColor: category.themeColor,
      },
      items: page.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        imageUrl: row.imageUrl,
        articleUrl: row.articleUrl,
        publishedAt: row.publishedAt,
        source: { name: row.source.name, logoUrl: row.source.logoUrl },
      })),
      hasMore,
      nextCursor: hasMore && last
        ? encodeCategoryCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
    };
  }
}
