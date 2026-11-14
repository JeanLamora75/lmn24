import { BadRequestException, Controller, Get, Header, Query } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

const LOCALES = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"] as const;
const KINDS = ["categories", "sources", "hashtags"] as const;
type Locale = (typeof LOCALES)[number];
type Kind = (typeof KINDS)[number];
const PAGE_SIZE = 1000;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(kind: string | undefined, locale: string | undefined): { kind: Kind; locale: Locale } {
  if (!KINDS.includes(kind as Kind) || !LOCALES.includes(locale as Locale)) {
    throw new BadRequestException("Paramètres SEO invalides.");
  }
  return { kind: kind as Kind, locale: locale as Locale };
}

/** Public discovery metadata only: no unpublished or administrative fields. */
@Controller("public/seo")
export class PublicSeoController {
  constructor(private readonly database: DatabaseService) {}

  private where(kind: Kind, locale: Locale) {
    if (kind === "categories") return { isActive: true, articles: { some: { languageIsoCode2: locale, source: { isActive: true } } } };
    if (kind === "sources") return { isActive: true, articles: { some: { languageIsoCode2: locale, category: { isActive: true } } } };
    return { isActive: true };
  }

  private count(kind: Kind, locale: Locale): Promise<number> {
    if (kind === "categories") return this.database.prisma.category.count({ where: this.where(kind, locale) });
    if (kind === "sources") return this.database.prisma.source.count({ where: this.where(kind, locale) });
    return this.database.prisma.hashtag.count({ where: this.where(kind, locale) });
  }

  @Get("sitemap-counts")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=240")
  async counts() {
    const results = await Promise.all(KINDS.flatMap(kind =>
      LOCALES.map(async locale => ({ kind, locale, count: await this.count(kind, locale) })),
    ));
    return { pageSize: PAGE_SIZE, results };
  }

  @Get("sitemap-items")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=240")
  async items(@Query("kind") rawKind?: string, @Query("locale") rawLocale?: string,
              @Query("page") rawPage?: string) {
    const { kind, locale } = validate(rawKind, rawLocale);
    if (!rawPage || !/^(?:0|[1-9]\d{0,5})$/.test(rawPage)) {
      throw new BadRequestException("Page SEO invalide.");
    }
    const page = Number(rawPage);
    const skip = page * PAGE_SIZE;
    // Fixed upper bound prevents expensive/unbounded offset queries.
    if (!Number.isSafeInteger(skip) || page > 9999) {
      throw new BadRequestException("Page SEO hors limite.");
    }
    const select = { slug: true, updatedAt: true } as const;
    const where = this.where(kind, locale);
    const results = kind === "categories"
      ? await this.database.prisma.category.findMany({ where, select, orderBy: { slug: "asc" }, skip, take: PAGE_SIZE })
      : kind === "sources"
        ? await this.database.prisma.source.findMany({ where, select, orderBy: { slug: "asc" }, skip, take: PAGE_SIZE })
        : await this.database.prisma.hashtag.findMany({ where, select, orderBy: { slug: "asc" }, skip, take: PAGE_SIZE });
    return { kind, locale, page, items: results
      .filter(item => slugPattern.test(item.slug) && item.slug.length <= 255)
      .map(item => ({ slug: item.slug, lastModified: item.updatedAt.toISOString() })) };
  }
}
