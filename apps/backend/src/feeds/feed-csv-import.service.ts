import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

const EXPECTED_HEADER = [
  "sourceWebsiteUrl",
  "category",
  "language",
  "feedUrl",
  "isActive",
] as const;

const INVALID_FORMAT_MESSAGE =
  "Le fichier CSV ne respecte pas le format attendu. Veuillez vérifier son format avant de recommencer.";

type ParsedFeedRow = {
  sourceId: string;
  categoryId: string;
  languageIsoCode2: string;
  feedUrl: string;
  isActive: boolean;
};

export type FeedCsvAnalysis = {
  feedsFound: number;
  newFeeds: number;
  errorFeeds: number;
  duplicates: number;
};

type PreparedImport = {
  analysis: FeedCsvAnalysis;
  rows: ParsedFeedRow[];
};

@Injectable()
export class FeedCsvImportService {
  constructor(private readonly database: DatabaseService) {}

  async analyze(
    buffer: Buffer,
    filename: string,
  ): Promise<FeedCsvAnalysis> {
    const prepared = await this.prepare(buffer, filename);
    return prepared.analysis;
  }

  async import(
    buffer: Buffer,
    filename: string,
  ): Promise<{ imported: number }> {
    const prepared = await this.prepare(buffer, filename);

    if (prepared.rows.length === 0) {
      return { imported: 0 };
    }

    const result = await this.database.prisma.$transaction((tx) =>
      tx.feed.createMany({
        data: prepared.rows.map((row) => ({
          sourceId: row.sourceId,
          categoryId: row.categoryId,
          languageIsoCode2: row.languageIsoCode2,
          feedUrl: row.feedUrl,
          isActive: row.isActive,
        })),
        skipDuplicates: true,
      }),
    );

    return {
      imported: result.count,
    };
  }

  private async prepare(
    buffer: Buffer,
    filename: string,
  ): Promise<PreparedImport> {
    if (!filename.toLocaleLowerCase().endsWith(".csv")) {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE);
    }

    const text = buffer.toString("utf8");

    if (!text.trim() || text.includes("\u0000")) {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE);
    }

    let records: string[][];

    try {
      records = this.parseCsv(text);
    } catch {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE);
    }

    const nonEmptyRecords = records.filter((record) =>
      record.some((value) => value.trim() !== ""),
    );

    const header = nonEmptyRecords[0];

    if (!header || !this.isExpectedHeader(header)) {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE);
    }

    const dataRows = nonEmptyRecords.slice(1);

    if (dataRows.some((row) => row.length !== EXPECTED_HEADER.length)) {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE);
    }

    const sourceUrls = Array.from(
      new Set(
        dataRows
          .map((row) => (row[0] ?? "").trim())
          .filter(Boolean),
      ),
    );
    const categorySlugs = Array.from(
      new Set(
        dataRows
          .map((row) => (row[1] ?? "").trim())
          .filter(Boolean),
      ),
    );
    const languageCodes = Array.from(
      new Set(
        dataRows
          .map((row) => (row[2] ?? "").trim().toLowerCase())
          .filter((value) => /^[a-z]{2}$/.test(value)),
      ),
    );
    const feedUrls = Array.from(
      new Set(
        dataRows
          .map((row) => (row[3] ?? "").trim())
          .filter(Boolean),
      ),
    );

    const [sources, categories, languages, existingFeeds] =
      await Promise.all([
        this.database.prisma.source.findMany({
          where: {
            websiteUrl: {
              in: sourceUrls,
            },
          },
          select: {
            id: true,
            websiteUrl: true,
          },
        }),
        this.database.prisma.category.findMany({
          where: {
            slug: {
              in: categorySlugs,
            },
          },
          select: {
            id: true,
            slug: true,
          },
        }),
        this.database.prisma.language.findMany({
          where: {
            isoCode2: {
              in: languageCodes,
            },
          },
          select: {
            isoCode2: true,
          },
        }),
        this.database.prisma.feed.findMany({
          where: {
            feedUrl: {
              in: feedUrls,
            },
          },
          select: {
            feedUrl: true,
          },
        }),
      ]);

    const sourceIdsByUrl = new Map<string, string[]>();

    for (const source of sources) {
      const ids = sourceIdsByUrl.get(source.websiteUrl) ?? [];
      ids.push(source.id);
      sourceIdsByUrl.set(source.websiteUrl, ids);
    }

    const categoryIds = new Map(
      categories.map((category) => [category.slug, category.id]),
    );
    const languageSet = new Set(
      languages.map((language) =>
        language.isoCode2.trim().toLowerCase(),
      ),
    );
    const existingFeedUrls = new Set(
      existingFeeds.map((feed) => feed.feedUrl),
    );
    const seenFileFeedUrls = new Set<string>();

    const analysis: FeedCsvAnalysis = {
      feedsFound: dataRows.length,
      newFeeds: 0,
      errorFeeds: 0,
      duplicates: 0,
    };
    const rows: ParsedFeedRow[] = [];

    for (const rawRow of dataRows) {
      const parsed = this.validateRow(
        rawRow,
        sourceIdsByUrl,
        categoryIds,
        languageSet,
      );

      if (!parsed) {
        analysis.errorFeeds += 1;
        continue;
      }

      if (existingFeedUrls.has(parsed.feedUrl)) {
        analysis.duplicates += 1;
        continue;
      }

      if (seenFileFeedUrls.has(parsed.feedUrl)) {
        analysis.errorFeeds += 1;
        continue;
      }

      seenFileFeedUrls.add(parsed.feedUrl);
      analysis.newFeeds += 1;
      rows.push(parsed);
    }

    return {
      analysis,
      rows,
    };
  }

  private validateRow(
    row: string[],
    sourceIdsByUrl: Map<string, string[]>,
    categoryIds: Map<string, string>,
    languageSet: Set<string>,
  ): ParsedFeedRow | null {
    const sourceWebsiteUrl = (row[0] ?? "").trim();
    const categorySlug = (row[1] ?? "").trim();
    const languageIsoCode2 = (row[2] ?? "").trim().toLowerCase();
    const feedUrl = (row[3] ?? "").trim();
    const rawIsActive = (row[4] ?? "").trim();

    const sourceIds = sourceIdsByUrl.get(sourceWebsiteUrl) ?? [];
    const categoryId = categoryIds.get(categorySlug);

    if (
      !sourceWebsiteUrl ||
      sourceWebsiteUrl.length > 2048 ||
      !this.isValidHttpUrl(sourceWebsiteUrl) ||
      sourceIds.length !== 1 ||
      !categorySlug ||
      categorySlug.length > 255 ||
      !categoryId ||
      !/^[a-z]{2}$/.test(languageIsoCode2) ||
      !languageSet.has(languageIsoCode2) ||
      !feedUrl ||
      feedUrl.length > 2048 ||
      !this.isValidHttpUrl(feedUrl) ||
      !["", "0", "1"].includes(rawIsActive)
    ) {
      return null;
    }

    return {
      sourceId: sourceIds[0]!,
      categoryId,
      languageIsoCode2,
      feedUrl,
      isActive: rawIsActive === "1",
    };
  }

  private isExpectedHeader(header: string[]): boolean {
    if (header.length !== EXPECTED_HEADER.length) {
      return false;
    }

    const normalized = [...header];
    normalized[0] = (normalized[0] ?? "").replace(/^\uFEFF/, "");

    return EXPECTED_HEADER.every(
      (expected, index) => normalized[index]?.trim() === expected,
    );
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private parseCsv(text: string): string[][] {
    const records: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let fieldStarted = false;

    const pushField = () => {
      row.push(field);
      field = "";
      fieldStarted = false;
    };

    const pushRow = () => {
      pushField();
      records.push(row);
      row = [];
    };

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (inQuotes) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }

        continue;
      }

      if (character === '"' && !fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
        continue;
      }

      if (character === ",") {
        pushField();
        continue;
      }

      if (character === "\n") {
        pushRow();
        continue;
      }

      if (character === "\r") {
        if (text[index + 1] === "\n") {
          continue;
        }

        pushRow();
        continue;
      }

      field += character;
      fieldStarted = true;
    }

    if (inQuotes) {
      throw new Error("unterminated quoted field");
    }

    if (field.length > 0 || row.length > 0 || text.endsWith(",")) {
      pushRow();
    }

    return records;
  }
}
