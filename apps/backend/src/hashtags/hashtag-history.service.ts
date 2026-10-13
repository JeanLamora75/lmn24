import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { compileHashtags, matchArticleHashtags } from "@lmn24/contracts";
import { DatabaseService } from "../database/database.service";

const BATCH_SIZE = 500;
const MAX_SCAN_AGE_MS = 2 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 60;

/** Scan a bounded page of retained articles. No ArticleHashtag association,
 * counters or job records are written in SCRUM-51.
 * The hourly aggregation worker (SCRUM-52) will reuse the same matcher.
 */
@Injectable()
export class HashtagHistoryService {
  constructor(private readonly db: DatabaseService) {}

  async scanPage(id: string, params: { cursor?: string | undefined; asOf?: string | undefined; version?: string | undefined }) {
    const subject = await this.db.prisma.hashtag.findUnique({
      where: { id },
      select: {
        id: true, name: true, updatedAt: true,
        aliases: { select: { name: true } },
      },
    });
    if (!subject) throw new NotFoundException("Hashtag introuvable.");

    const version = subject.updatedAt.toISOString();
    if (params.version && params.version !== version) {
      throw new ConflictException("Le hashtag a été modifié : relancez l'analyse.");
    }
    const now = new Date();
    const asOf = params.asOf ? new Date(params.asOf) : now;
    if (!Number.isFinite(asOf.getTime()) || asOf.getTime() > now.getTime() + 5000
      || now.getTime() - asOf.getTime() > MAX_SCAN_AGE_MS) {
      throw new BadRequestException("Date d'analyse expirée ou invalide : relancez l'analyse.");
    }

    const row = await this.db.prisma.setting.findFirst({
      where: { key: "retentionArticlesDays", scope: "GLOBAL", scopeId: null },
      select: { value: true },
    });
    const days = Number(row?.value ?? DEFAULT_RETENTION_DAYS);
    if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
      throw new BadRequestException("Le paramètre de rétention des articles est invalide.");
    }
    const cutoff = new Date(asOf.getTime() - days * 86_400_000);
    const matcher = compileHashtags([subject]);
    const articles = await this.db.prisma.article.findMany({
      where: { publishedAt: { gte: cutoff, lte: asOf } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: { id: true, title: true, summary: true, publishedAt: true },
    });

    let matchingArticles = 0;
    const byHour = new Map<string, number>();
    for (const article of articles) {
      if (!matchArticleHashtags(article, matcher).length) continue;
      matchingArticles += 1;
      const hour = new Date(article.publishedAt);
      hour.setUTCMinutes(0, 0, 0);
      const key = hour.toISOString();
      byHour.set(key, (byHour.get(key) ?? 0) + 1);
    }
    return {
      asOf: asOf.toISOString(),
      definitionVersion: version,
      retentionDays: days,
      scannedArticles: articles.length,
      matchingArticles,
      hourlyMatches: [...byHour].map(([hourUtc, articleCount]) => ({ hourUtc, articleCount })),
      nextCursor: articles.length === BATCH_SIZE ? articles.at(-1)!.id : null,
    };
  }
}
