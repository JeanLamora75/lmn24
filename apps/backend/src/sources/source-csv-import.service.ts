import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

const EXPECTED_HEADER = [
  "name",
  "slug",
  "websiteUrl",
  "country",
  "isActive",
] as const;

const INVALID_FORMAT_MESSAGE =
  "Le fichier CSV ne respecte pas le format attendu. Veuillez vérifier son format avant de recommencer.";

type ParsedSourceRow = {
  name: string;
  slug: string;
  websiteUrl: string;
  countryIsoCode2: string;
  isActive: boolean;
};

type Analysis = {
  sourcesFound: number;
  newSources: number;
  errorSources: number;
  duplicates: number;
};

type PreparedImport = {
  analysis: Analysis;
  rows: Array<{
    name: string;
    slug: string;
    websiteUrl: string;
    countryId: string;
    isActive: boolean;
  }>;
};

@Injectable()
export class SourceCsvImportService {
  constructor(private readonly database: DatabaseService) {}

  async analyze(buffer: Buffer, filename: string): Promise<Analysis> {
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
      tx.source.createMany({
        data: prepared.rows.map((row) => ({
          name: row.name,
          slug: row.slug,
          websiteUrl: row.websiteUrl,
          countryId: row.countryId,
          isActive: row.isActive,
          logoUrl: null,
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

    const countryCodes = Array.from(
      new Set(
        dataRows
          .map((row) => (row[3] ?? "").trim().toUpperCase())
          .filter((value) => /^[A-Z]{2}$/.test(value)),
      ),
    );

    const slugs = Array.from(
      new Set(
        dataRows
          .map((row) => (row[1] ?? "").trim())
          .filter(Boolean),
      ),
    );

    const [countries, existingSources] = await Promise.all([
      this.database.prisma.country.findMany({
        where: {
          isoCode2: {
            in: countryCodes,
          },
        },
        select: {
          id: true,
          isoCode2: true,
        },
      }),
      this.database.prisma.source.findMany({
        where: {
          slug: {
            in: slugs,
          },
        },
        select: {
          slug: true,
        },
      }),
    ]);

    const countryIds = new Map(
      countries.map((country) => [
        country.isoCode2.trim().toUpperCase(),
        country.id,
      ]),
    );
    const existingSlugs = new Set(
      existingSources.map((source) => source.slug),
    );
    const seenFileSlugs = new Set<string>();

    const analysis: Analysis = {
      sourcesFound: dataRows.length,
      newSources: 0,
      errorSources: 0,
      duplicates: 0,
    };

    const rows: PreparedImport["rows"] = [];

    for (const rawRow of dataRows) {
      const parsed = this.validateRow(rawRow, countryIds);

      if (!parsed) {
        analysis.errorSources += 1;
        continue;
      }

      if (existingSlugs.has(parsed.slug)) {
        analysis.duplicates += 1;
        continue;
      }

      if (seenFileSlugs.has(parsed.slug)) {
        analysis.errorSources += 1;
        continue;
      }

      seenFileSlugs.add(parsed.slug);
      analysis.newSources += 1;

      rows.push({
        name: parsed.name,
        slug: parsed.slug,
        websiteUrl: parsed.websiteUrl,
        countryId: countryIds.get(parsed.countryIsoCode2)!,
        isActive: parsed.isActive,
      });
    }

    return {
      analysis,
      rows,
    };
  }

  private validateRow(
    row: string[],
    countryIds: Map<string, string>,
  ): ParsedSourceRow | null {
    const name = (row[0] ?? "").trim();
    const slug = (row[1] ?? "").trim();
    const websiteUrl = (row[2] ?? "").trim();
    const countryIsoCode2 = (row[3] ?? "").trim().toUpperCase();
    const rawIsActive = (row[4] ?? "").trim();

    if (
      !name ||
      name.length > 255 ||
      !slug ||
      slug.length > 255 ||
      !websiteUrl ||
      websiteUrl.length > 2048 ||
      !/^[A-Z]{2}$/.test(countryIsoCode2) ||
      !countryIds.has(countryIsoCode2) ||
      !["", "0", "1"].includes(rawIsActive) ||
      !this.isValidHttpUrl(websiteUrl)
    ) {
      return null;
    }

    return {
      name,
      slug,
      websiteUrl,
      countryIsoCode2,
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
