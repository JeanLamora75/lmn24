import {
  BadRequestException, ConflictException, Injectable, NotFoundException, Optional,
} from "@nestjs/common";
import { normalizeHashtagTerm } from "@lmn24/contracts";
import { DatabaseService } from "../database/database.service";
import { HashtagStatsService } from "./hashtag-stats.service";
import { HashtagMediaService } from "./hashtag-media.service";

export type HashtagAliasInput = { name: string; languageIsoCode2?: string | null | undefined };
export type HashtagInput = {
  name: string;
  slug: string;
  isActive: boolean;
  aliases: HashtagAliasInput[];
};
export type HashtagListInput = {
  search?: string | undefined;
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

const summaryFields = {
  id: true, name: true, slug: true, imageUrl: true, isActive: true,
  createdAt: true, updatedAt: true,
  aliases: {
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, normalizedName: true, languageIsoCode2: true },
  },
  _count: { select: { hourlyCounts: true } },
} as const;

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "code" in error && error.code === "P2002";
}

@Injectable()
export class HashtagsService {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly media?: HashtagMediaService,
    @Optional() private readonly stats?: HashtagStatsService,
  ) {}

  async list(params: HashtagListInput) {
    const where = {
      ...(params.status === "active" ? { isActive: true }
        : params.status === "inactive" ? { isActive: false } : {}),
      ...(params.search
        ? { OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { slug: { contains: params.search, mode: "insensitive" as const } },
            { aliases: { some: { name: { contains: params.search, mode: "insensitive" as const } } } },
          ] }
        : {}),
    };
    const total = await this.database.prisma.hashtag.count({ where });
    const totalPages = Math.ceil(total / params.pageSize);
    const page = Math.min(params.page, Math.max(totalPages, 1));
    const items = await this.database.prisma.hashtag.findMany({
      where, select: summaryFields,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * params.pageSize, take: params.pageSize,
    });
    return { items: items.map(({ _count, ...item }) => ({
      ...item, hourlyCountRows: _count.hourlyCounts,
    })), pagination: { page, pageSize: params.pageSize, total, totalPages } };
  }

  async getById(id: string) {
    const hashtag = await this.database.prisma.hashtag.findUnique({
      where: { id }, select: summaryFields,
    });
    if (!hashtag) throw new NotFoundException("Hashtag introuvable.");
    const { _count, ...item } = hashtag;
    return { ...item, hourlyCountRows: _count.hourlyCounts };
  }

  private validateAliases(input: HashtagInput) {
    const main = normalizeHashtagTerm(input.name);
    if (!main || !/[\p{L}\p{N}]/u.test(main)) {
      throw new BadRequestException("Nom de hashtag invalide.");
    }
    const seen = new Set<string>([main]);
    return input.aliases.map((alias) => {
      const normalizedName = normalizeHashtagTerm(alias.name);
      if (!normalizedName || !/[\p{L}\p{N}]/u.test(normalizedName)) {
        throw new BadRequestException("Un alias est vide ou invalide.");
      }
      if (seen.has(normalizedName)) {
        throw new BadRequestException("Un alias est présent plusieurs fois ou identique au nom principal.");
      }
      seen.add(normalizedName);
      return {
        name: alias.name.trim(),
        normalizedName,
        languageIsoCode2: alias.languageIsoCode2 ?? null,
      };
    });
  }

  async getWarnings(input: HashtagInput, exceptId?: string) {
    const values = [input.name, ...input.aliases.map((x) => x.name)];
    const warnings: string[] = [];
    const suspicious = values.filter((name) => normalizeHashtagTerm(name).length <= 3);
    if (suspicious.length) {
      warnings.push("Termes courts : risque de correspondances ambiguës (" + suspicious.join(", ") + ").");
    }
    // Query potential overlaps, then confirm equality with the canonicalizer.
    // No semantic interpretation: multiple unrelated hashtags may share a term.
    const normalized = new Set(values.map(normalizeHashtagTerm));
    const other = await this.database.prisma.hashtag.findMany({
      where: { ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true, aliases: { select: { name: true } } },
    });
    const overlaps = other.filter((item) =>
      [item.name, ...item.aliases.map((a) => a.name)].some(
        (value) => normalized.has(normalizeHashtagTerm(value)),
      )).map((x) => x.name);
    if (overlaps.length) {
      warnings.push("Variantes également utilisées par : " + overlaps.slice(0, 8).join(", ") + ".");
    }
    if (values.some((value) => normalizeHashtagTerm(value).length <= 5)) {
      warnings.push("Vérifiez les homonymes (lieux, personnes, organisations) avant l'activation.");
    }
    return warnings;
  }

  async create(input: HashtagInput) {
    const aliases = this.validateAliases(input);
    try {
      const item = await this.database.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)`;
        return tx.hashtag.create({
          data: {
            name: input.name.trim(), slug: input.slug,
            isActive: input.isActive,
            aliases: { create: aliases },
          },
        });
      });
      this.stats?.enqueue(item.id);
      return this.getById(item.id);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictException("Ce slug ou l'un de ses alias existe déjà pour ce hashtag.");
      }
      throw error;
    }
  }

  async update(id: string, input: HashtagInput) {
    const aliases = this.validateAliases(input);
    await this.getById(id);
    try {
      await this.database.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)`;
        await tx.hashtag.update({ where: { id }, data: {
          name: input.name.trim(), slug: input.slug, isActive: input.isActive,
        } });
        await tx.hashtagAlias.deleteMany({ where: { hashtagId: id } });
        if (aliases.length) {
          await tx.hashtagAlias.createMany({
            data: aliases.map((alias) => ({ ...alias, hashtagId: id })),
          });
        }
      });
      this.stats?.enqueue(id);
      return this.getById(id);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictException("Ce slug ou l'un de ses alias existe déjà pour ce hashtag.");
      }
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean) {
    await this.getById(id);
    await this.database.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)`;
      await tx.hashtag.update({ where: { id }, data: { isActive } });
    });
    this.stats?.enqueue(id);
    return this.getById(id);
  }

  /** Persist a new managed image only after the hashtag exists.
   * Conditional update prevents a concurrent edit from orphaning an image.
   */
  private async attachImage(id: string, url: string) {
    try {
      const current = await this.getById(id);
      const updated = await this.database.prisma.hashtag.updateMany({
        where: { id, imageUrl: current.imageUrl }, data: { imageUrl: url },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Le hashtag a été modifié. Réessayez après rechargement.");
      }
      await this.media?.deleteLocalImage(current.imageUrl);
      return this.getById(id);
    } catch (error) {
      await this.media?.deleteLocalImage(url);
      throw error;
    }
  }

  async uploadImage(id: string, buffer: Buffer) {
    if (!this.media) throw new Error("HashtagMediaService is required.");
    await this.getById(id);
    const url = await this.media.storeImage(buffer);
    return this.attachImage(id, url);
  }

  async importImage(id: string, url: string) {
    if (!this.media) throw new Error("HashtagMediaService is required.");
    await this.getById(id);
    const stored = await this.media.importFromUrl(url);
    return this.attachImage(id, stored);
  }

  async removeImage(id: string) {
    const current = await this.getById(id);
    if (current.imageUrl === null) return current;
    const updated = await this.database.prisma.hashtag.updateMany({
      where: { id, imageUrl: current.imageUrl }, data: { imageUrl: null },
    });
    if (updated.count !== 1) {
      throw new ConflictException("Le hashtag a été modifié. Réessayez après rechargement.");
    }
    await this.media?.deleteLocalImage(current.imageUrl);
    return this.getById(id);
  }

  async delete(id: string) {
    const existing = await this.getById(id);
    await this.database.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(52024, 52)`;
      await tx.hashtag.delete({ where: { id } });
    });
    await this.media?.deleteLocalImage(existing.imageUrl);
    // Alias and hourly counts are removed by database CASCADE.
    // Image cleanup will be introduced by SCRUM-50.
    return { deleted: true, aliasCount: existing.aliases.length,
      hourlyCountRows: existing.hourlyCountRows };
  }
}
