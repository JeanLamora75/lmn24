import { compileHashtags, matchArticleHashtags } from "@lmn24/contracts";
import type { Prisma } from "./generated/prisma/client";
import type { DatabaseClient } from "./client";

/**
 * One PostgreSQL advisory transaction lock for the writers of BOTH Article
 * and HashtagHourlyCount. The lock serializes parser inserts, rebuilds and
 * subject-definition edits; it does NOT lock public readers.
 *
 * This module intentionally stores NO ArticleHashtag join table.
 */
export const HASHTAG_STATS_LOCK = [52024, 52] as const;
const BATCH = 500;
const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 60;
const MAX_REBUILD_MS = 15 * 60_000;

export type StoredArticle = Readonly<{
  id: string;
  title: string;
  summary: string | null;
  publishedAt: Date;
}>;

export function startOfUtcHour(value: Date): Date {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

export function collectHashtagHours(
  articles: readonly StoredArticle[],
  definitions: ReturnType<typeof compileHashtags>,
  counts: Map<string, { hashtagId: string; hourUtc: Date; articleCount: number }>,
  start: Date,
  end: Date,
): number {
  let matched = 0;
  for (const article of articles) {
    if (article.publishedAt < start || article.publishedAt > end) continue;
    const hashtags = matchArticleHashtags(article, definitions);
    if (hashtags.length) matched += 1;
    const hourUtc = startOfUtcHour(article.publishedAt);
    for (const hashtagId of hashtags) {
      const key = hashtagId + ":" + hourUtc.toISOString();
      const previous = counts.get(key);
      if (previous) previous.articleCount += 1;
      else counts.set(key, { hashtagId, hourUtc, articleCount: 1 });
    }
  }
  return matched;
}

async function readRetentionDays(client: Pick<DatabaseClient, "setting">): Promise<number> {
  const rows = await client.setting.findMany({
    where: { scope: "GLOBAL", scopeId: null, key: {
      in: ["retentionArticlesDays", "retentionHashtagHourlyCountsDays"],
    } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const days = ["retentionArticlesDays", "retentionHashtagHourlyCountsDays"].map((key) => {
    const raw = values.get(key);
    const parsed = raw == null ? DEFAULT_DAYS : Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3650) {
      throw new Error("Invalid LMN24 retention setting: " + key);
    }
    return parsed;
  });
  return Math.min(...days);
}

/**
 * The returned rows are the ones actually committed by PostgreSQL, not the
 * RSS feed candidates. If writing a counter fails, its article INSERT rolls
 * back in the SAME transaction and can be retried safely.
 */
export async function insertArticlesAndCount(
  database: DatabaseClient,
  data: Prisma.ArticleCreateManyInput[],
  now = new Date(),
): Promise<{ imported: number; matched: number }> {
  if (!data.length) return { imported: 0, matched: 0 };
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)::text`;
    const retentionDays = await readRetentionDays(tx);
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const hashtags = compileHashtags(await tx.hashtag.findMany({
      where: { isActive: true },
      select: { id: true, name: true, aliases: { select: { name: true } } },
    }));
    const inserted = await tx.article.createManyAndReturn({
      data, skipDuplicates: true,
      select: { id: true, title: true, summary: true, publishedAt: true },
    });
    const counts = new Map<string, { hashtagId: string; hourUtc: Date; articleCount: number }>();
    const matched = collectHashtagHours(inserted, hashtags, counts, cutoff, now);
    for (const bucket of counts.values()) {
      await tx.hashtagHourlyCount.upsert({
        where: { hashtagId_hourUtc: { hashtagId: bucket.hashtagId, hourUtc: bucket.hourUtc } },
        create: bucket,
        update: { articleCount: { increment: bucket.articleCount } },
      });
    }
    return { imported: inserted.length, matched };
  }, { maxWait: 60_000, timeout: 60_000 });
}

export type RebuildOptions = Readonly<{
  hashtagId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}>;

export type RebuildResult = Readonly<{
  scannedArticles: number;
  matchingArticles: number;
  countedBuckets: number;
  from: string;
  through: string;
  hashtagId: string | null;
}>;

/**
 * Reconciliation is atomic: readers see either the old counts or a complete
 * new set, never a partial replacement. For a targeted subject rebuild,
 * unrelated subjects are untouched. A partial-hour window is expanded to
 * UTC-hour boundaries so whole hours are consistently replaced.
 *
 * The default full rebuild also removes expired/obsolete rows (including
 * those left by deletions or by previous definitions of a hashtag).
 */
export async function rebuildHashtagHourlyCounts(
  database: DatabaseClient,
  options: RebuildOptions = {},
  now = new Date(),
): Promise<RebuildResult> {
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)::text`;
    const days = await readRetentionDays(tx);
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const start = options.from && options.from > cutoff ? options.from : cutoff;
    const lower = startOfUtcHour(start);
    const through = options.to && options.to < now ? options.to : now;
    if (!Number.isFinite(lower.getTime()) || !Number.isFinite(through.getTime()) ||
        through < lower) throw new Error("Invalid hashtag rebuild window.");
    const end = new Date(startOfUtcHour(through).getTime() + 3_600_000);

    const definitions = await tx.hashtag.findMany({
      where: options.hashtagId ? { id: options.hashtagId } : {},
      select: { id: true, name: true, aliases: { select: { name: true } } },
    });
    if (options.hashtagId && definitions.length === 0) {
      throw new Error("Hashtag not found during rebuild.");
    }
    const compiled = compileHashtags(definitions);
    const buckets = new Map<string, { hashtagId: string; hourUtc: Date; articleCount: number }>();
    let cursor: string | undefined;
    let scannedArticles = 0;
    let matchingArticles = 0;
    while (true) {
      const articles = await tx.article.findMany({
        where: { publishedAt: { gte: start, lt: end } },
        orderBy: { id: "asc" }, take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, title: true, summary: true, publishedAt: true },
      });
      if (!articles.length) break;
      scannedArticles += articles.length;
      matchingArticles += collectHashtagHours(articles, compiled, buckets, start, through);
      cursor = articles.at(-1)!.id;
      if (articles.length < BATCH) break;
    }

    // All sub-operations run in this same transaction. If any write fails,
    // PostgreSQL rolls back deletion AND replacement.
    await tx.hashtagHourlyCount.deleteMany({
      where: {
        ...(options.hashtagId ? { hashtagId: options.hashtagId } : {}),
        ...(options.from || options.to ? { hourUtc: { gte: lower, lt: end } } : {}),
      },
    });
    const counted = [...buckets.values()];
    for (let i = 0; i < counted.length; i += BATCH) {
      await tx.hashtagHourlyCount.createMany({ data: counted.slice(i, i + BATCH) });
    }
    return {
      scannedArticles,
      matchingArticles,
      countedBuckets: counted.length,
      from: start.toISOString(),
      through: through.toISOString(),
      hashtagId: options.hashtagId ?? null,
    };
  }, { maxWait: 60_000, timeout: MAX_REBUILD_MS });
}
