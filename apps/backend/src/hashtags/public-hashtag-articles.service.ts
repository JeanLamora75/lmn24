import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CATEGORY_INITIAL_PAGE_SIZE, CATEGORY_MAX_PAGE_SIZE,
  compileHashtags, matchArticleHashtags,
} from "@lmn24/contracts";
import { DatabaseService } from "../database/database.service";
import { decodeCategoryCursor, encodeCategoryCursor } from "../categories/public-category.service";
import type { PublicHomeArticle } from "../categories/public-home.service";

const BATCH = 400;
const DEFAULT_RETENTION_DAYS = 60;
const DAY_MS = 86_400_000;

type Candidate = {
  id: string;
  publishedAt: Date;
  title: string;
  summary: string | null;
};
type Position = Pick<Candidate, "id" | "publishedAt">;

export type HashtagArticlesPage = {
  hashtag: { id: string; slug: string; name: string; imageUrl: string | null };
  items: PublicHomeArticle[];
  hasMore: boolean;
  nextCursor: string | null;
};

/**
 * The display must use precisely the same Unicode/alias matcher as ingestion.
 * A scan is bounded by retention and a 400-row DB chunk (not memory-loading
 * the whole article table). It uses the existing published_at index and
 * keyset pagination, then fetches only the selected card details.
 *
 * Future optimization: persist indexed canonical title/summary columns;
 * a raw ILIKE/unaccent filter alone would miss valid Unicode matches.
 */
@Injectable()
export class PublicHashtagArticlesService {
  constructor(private readonly database: DatabaseService) {}

  async getArticles(
    slug: string,
    rawCursor?: string,
    limit = CATEGORY_INITIAL_PAGE_SIZE,
    now = new Date(),
  ): Promise<HashtagArticlesPage> {
    if (!Number.isInteger(limit) || limit < 1 || limit > CATEGORY_MAX_PAGE_SIZE) {
      throw new BadRequestException("Taille de page invalide.");
    }
    const cursor = rawCursor ? decodeCategoryCursor(rawCursor) : null;
    const subject = await this.database.prisma.hashtag.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true, slug: true, name: true, imageUrl: true,
        aliases: { select: { name: true } },
      },
    });
    if (!subject) throw new NotFoundException("Hashtag introuvable.");

    const retention = await this.database.prisma.setting.findFirst({
      where: { key: "retentionArticlesDays", scope: "GLOBAL", scopeId: null },
      select: { value: true },
    });
    const days = retention ? Number(retention.value) : DEFAULT_RETENTION_DAYS;
    if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
      throw new BadRequestException("Configuration de rétention des articles invalide.");
    }
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const matcher = compileHashtags([subject]);
    const found: Candidate[] = [];
    let position: Position | null = cursor;

    // Search only the retained period, using indexed keyset reads. Do not
    // concatenate title and summary: a multi-word alias cannot span fields.
    while (found.length <= limit) {
      const rows: Candidate[] = await this.database.prisma.article.findMany({
        where: {
          publishedAt: { gte: cutoff, lte: now },
          ...(position ? { OR: [
            { publishedAt: { lt: position.publishedAt } },
            { publishedAt: position.publishedAt, id: { lt: position.id } },
          ] } : {}),
        },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: BATCH,
        select: { id: true, publishedAt: true, title: true, summary: true },
      });
      if (!rows.length) break;
      for (const candidate of rows) {
        if (matchArticleHashtags(candidate, matcher).length) {
          found.push(candidate);
          if (found.length > limit) break;
        }
      }
      if (found.length > limit || rows.length < BATCH) break;
      const last = rows.at(-1)!;
      position = { id: last.id, publishedAt: last.publishedAt };
    }

    const hasMore = found.length > limit;
    const selected = found.slice(0, limit);
    const last = selected.at(-1);
    if (!selected.length) {
      return {
        hashtag: { id: subject.id, slug: subject.slug, name: subject.name,
          imageUrl: subject.imageUrl },
        items: [], hasMore: false, nextCursor: null,
      };
    }

    const details = await this.database.prisma.article.findMany({
      where: { id: { in: selected.map((row) => row.id) } },
      select: {
        id: true, title: true, summary: true, imageUrl: true,
        articleUrl: true, publishedAt: true,
        source: {
          select: {
            name: true, logoUrl: true,
            country: { select: { isoCode2: true } },
          },
        },
      },
    });
    const byId = new Map(details.map((row) => [row.id, row]));
    const items: PublicHomeArticle[] = selected.flatMap((candidate) => {
      const row = byId.get(candidate.id);
      if (!row) return [];
      return [{
        id: row.id, title: row.title, summary: row.summary,
        imageUrl: row.imageUrl, articleUrl: row.articleUrl,
        publishedAt: row.publishedAt,
        source: {
          name: row.source.name, logoUrl: row.source.logoUrl,
          countryIsoCode2: row.source.country.isoCode2,
        },
      }];
    });
    return {
      hashtag: { id: subject.id, slug: subject.slug, name: subject.name,
        imageUrl: subject.imageUrl },
      items,
      hasMore,
      nextCursor: hasMore && last
        ? encodeCategoryCursor({ id: last.id, publishedAt: last.publishedAt })
        : null,
    };
  }
}
