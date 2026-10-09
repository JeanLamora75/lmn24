import type { DatabaseClient } from "@lmn24/database";

import { parseFeedXml } from "./feed-parser.js";

export type ParserFilters = {
  countryIsoCode2?: string | undefined;
  languageIsoCode2?: string | undefined;
  categoryId?: string | undefined;
};

export type ParserEvent = {
  type:
    | "run-started"
    | "feed-started"
    | "feed-success"
    | "feed-error"
    | "run-completed"
    | "run-error";
  timestamp: string;
  message: string;
  feedUrl?: string | undefined;
  feedIndex?: number | undefined;
  feedTotal?: number | undefined;
  itemsFound?: number | undefined;
  articlesImported?: number | undefined;
  articlesSkipped?: number | undefined;
};

type FeedRow = {
  id: string;
  sourceId: string;
  categoryId: string;
  languageIsoCode2: string;
  feedUrl: string;
};

type FeedResult =
  | {
      ok: true;
      itemsFound: number;
      articlesImported: number;
      articlesSkipped: number;
    }
  | {
      ok: false;
      error: string;
    };

type ParserSettings = {
  timeoutMs: number;
  retryCount: number;
};

const SETTING_TIMEOUT = "parser.feed_timeout_seconds";
const SETTING_RETRY = "parser.feed_retry_count";
const INSERT_CHUNK_SIZE = 500;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue.";
}

function splitIntoChunks<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class ParserEngine {
  constructor(private readonly database: DatabaseClient) {}

  async run(
    filters: ParserFilters,
    emit: (event: ParserEvent) => void,
  ): Promise<void> {
    const settings = await this.loadSettings();
    const feeds = await this.loadFeeds(filters);

    emit({
      type: "run-started",
      timestamp: new Date().toISOString(),
      message:
        "Extraction démarrée — " +
        feeds.length +
        " flux à traiter.",
      feedTotal: feeds.length,
    });

    let successfulFeeds = 0;
    let failedFeeds = 0;
    let totalItemsFound = 0;
    let totalImported = 0;
    let totalSkipped = 0;

    for (let index = 0; index < feeds.length; index += 1) {
      const feed = feeds[index]!;

      emit({
        type: "feed-started",
        timestamp: new Date().toISOString(),
        message:
          "Traitement " +
          (index + 1) +
          "/" +
          feeds.length +
          " — " +
          feed.feedUrl,
        feedUrl: feed.feedUrl,
        feedIndex: index + 1,
        feedTotal: feeds.length,
      });

      try {
        const result = await this.processFeed(feed, settings);

        if (result.ok) {
          successfulFeeds += 1;
          totalItemsFound += result.itemsFound;
          totalImported += result.articlesImported;
          totalSkipped += result.articlesSkipped;

          emit({
            type: "feed-success",
            timestamp: new Date().toISOString(),
            message:
              "Succès — " +
              result.itemsFound +
              " articles détectés — " +
              result.articlesImported +
              " ajoutés — " +
              result.articlesSkipped +
              " ignorés",
            feedUrl: feed.feedUrl,
            feedIndex: index + 1,
            feedTotal: feeds.length,
            itemsFound: result.itemsFound,
            articlesImported: result.articlesImported,
            articlesSkipped: result.articlesSkipped,
          });
        } else {
          failedFeeds += 1;

          emit({
            type: "feed-error",
            timestamp: new Date().toISOString(),
            message: "Échec — " + feed.feedUrl + " — " + result.error,
            feedUrl: feed.feedUrl,
            feedIndex: index + 1,
            feedTotal: feeds.length,
          });
        }
      } catch (error) {
        failedFeeds += 1;

        emit({
          type: "feed-error",
          timestamp: new Date().toISOString(),
          message:
            "Échec — " + feed.feedUrl + " — " + errorMessage(error),
          feedUrl: feed.feedUrl,
          feedIndex: index + 1,
          feedTotal: feeds.length,
        });
      }
    }

    emit({
      type: "run-completed",
      timestamp: new Date().toISOString(),
      message:
        "Extraction terminée.\n\n" +
        feeds.length +
        " flux traités\n" +
        successfulFeeds +
        " flux réussis\n" +
        failedFeeds +
        " flux en erreur\n" +
        totalItemsFound +
        " articles détectés\n" +
        totalImported +
        " nouveaux articles enregistrés\n" +
        totalSkipped +
        " articles ignorés",
      feedTotal: feeds.length,
      itemsFound: totalItemsFound,
      articlesImported: totalImported,
      articlesSkipped: totalSkipped,
    });
  }

  private async loadSettings(): Promise<ParserSettings> {
    const settings = await this.database.setting.findMany({
      where: {
        scope: "GLOBAL",
        scopeId: null,
        key: {
          in: [SETTING_TIMEOUT, SETTING_RETRY],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const values = new Map(settings.map((item) => [item.key, item.value]));
    const timeoutSeconds = Number.parseInt(
      values.get(SETTING_TIMEOUT) ?? "",
      10,
    );
    const retryCount = Number.parseInt(
      values.get(SETTING_RETRY) ?? "",
      10,
    );

    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error(
        "Le paramètre " +
          SETTING_TIMEOUT +
          " est absent ou invalide.",
      );
    }

    if (!Number.isInteger(retryCount) || retryCount < 0) {
      throw new Error(
        "Le paramètre " +
          SETTING_RETRY +
          " est absent ou invalide.",
      );
    }

    return {
      timeoutMs: timeoutSeconds * 1000,
      retryCount,
    };
  }

  private async loadFeeds(filters: ParserFilters): Promise<FeedRow[]> {
    return this.database.feed.findMany({
      where: {
        isActive: true,
        ...(filters.categoryId
          ? { categoryId: filters.categoryId }
          : {}),
        ...(filters.languageIsoCode2
          ? {
              languageIsoCode2: filters.languageIsoCode2
                .trim()
                .toLowerCase(),
            }
          : {}),
        ...(filters.countryIsoCode2
          ? {
              source: {
                country: {
                  isoCode2: filters.countryIsoCode2
                    .trim()
                    .toUpperCase(),
                },
              },
            }
          : {}),
      },
      orderBy: [
        {
          source: {
            name: "asc",
          },
        },
        { feedUrl: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        sourceId: true,
        categoryId: true,
        languageIsoCode2: true,
        feedUrl: true,
      },
    });
  }

  private async processFeed(
    feed: FeedRow,
    settings: ParserSettings,
  ): Promise<FeedResult> {
    const startedAt = new Date();
    const feedRun = await this.database.feedRun.create({
      data: {
        feedId: feed.id,
        startedAt,
        status: "RUNNING",
      },
      select: {
        id: true,
      },
    });

    let finalError = "Échec du traitement du flux.";

    for (
      let attempt = 0;
      attempt <= settings.retryCount;
      attempt += 1
    ) {
      try {
        const response = await fetch(feed.feedUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(settings.timeoutMs),
          headers: {
            accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
            "user-agent": "LMN24 RSS/XML Parser",
          },
        });

        if (!response.ok) {
          throw new Error(
            "HTTP " + response.status + " " + response.statusText,
          );
        }

        const xml = await response.text();
        const parsed = await parseFeedXml(xml, response.url || feed.feedUrl);
        const imported = await this.importArticles(feed, parsed.articles);
        const finishedAt = new Date();
        const durationMs = Math.max(
          0,
          finishedAt.getTime() - startedAt.getTime(),
        );
        const skipped = Math.max(0, parsed.itemsFound - imported);

        await this.database.$transaction([
          this.database.feed.update({
            where: { id: feed.id },
            data: {
              lastFetchedAt: finishedAt,
              lastFetchDurationMs: durationMs,
              lastFetchStatus: "SUCCESS",
              lastError: null,
            },
          }),
          this.database.feedRun.update({
            where: { id: feedRun.id },
            data: {
              finishedAt,
              durationMs,
              status: "SUCCESS",
              itemsFound: parsed.itemsFound,
              articlesImported: imported,
              articlesSkipped: skipped,
              errorMessage: null,
            },
          }),
        ]);

        return {
          ok: true,
          itemsFound: parsed.itemsFound,
          articlesImported: imported,
          articlesSkipped: skipped,
        };
      } catch (error) {
        finalError = errorMessage(error);
      }
    }

    const finishedAt = new Date();
    const durationMs = Math.max(
      0,
      finishedAt.getTime() - startedAt.getTime(),
    );

    await this.database.$transaction([
      this.database.feed.update({
        where: { id: feed.id },
        data: {
          lastFetchedAt: finishedAt,
          lastFetchDurationMs: durationMs,
          lastFetchStatus: "ERROR",
          lastError: finalError,
        },
      }),
      this.database.feedRun.update({
        where: { id: feedRun.id },
        data: {
          finishedAt,
          durationMs,
          status: "ERROR",
          errorMessage: finalError,
        },
      }),
    ]);

    return {
      ok: false,
      error: finalError,
    };
  }

  private async importArticles(
    feed: FeedRow,
    parsedArticles: Awaited<
      ReturnType<typeof parseFeedXml>
    >["articles"],
  ): Promise<number> {
    if (parsedArticles.length === 0) {
      return 0;
    }

    const uniqueByUrl = new Map(
      parsedArticles.map((article) => [article.articleUrl, article]),
    );
    const uniqueArticles = [...uniqueByUrl.values()];
    const existingUrls = new Set<string>();

    for (const chunk of splitIntoChunks(
      uniqueArticles.map((article) => article.articleUrl),
      INSERT_CHUNK_SIZE,
    )) {
      const existing = await this.database.article.findMany({
        where: {
          articleUrl: {
            in: chunk,
          },
        },
        select: {
          articleUrl: true,
        },
      });

      for (const article of existing) {
        existingUrls.add(article.articleUrl);
      }
    }

    const newArticles = uniqueArticles.filter(
      (article) => !existingUrls.has(article.articleUrl),
    );

    let imported = 0;

    for (const chunk of splitIntoChunks(
      newArticles,
      INSERT_CHUNK_SIZE,
    )) {
      const result = await this.database.article.createMany({
        data: chunk.map((article) => ({
          feedId: feed.id,
          sourceId: feed.sourceId,
          categoryId: feed.categoryId,
          languageIsoCode2: feed.languageIsoCode2.trim().toLowerCase(),
          title: article.title,
          summary: article.summary,
          imageUrl: article.imageUrl,
          articleUrl: article.articleUrl,
          publishedAt: article.publishedAt,
        })),
        skipDuplicates: true,
      });

      imported += result.count;
    }

    return imported;
  }
}
