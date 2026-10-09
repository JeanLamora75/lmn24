import { Injectable } from "@nestjs/common";
import type { CategoryHomeLayout } from "@lmn24/contracts";
import { CATEGORY_HOME_LAYOUT_CAPACITY } from "@lmn24/contracts";

import { DatabaseService } from "../database/database.service";

export type PublicHomeArticle = {
  id: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  articleUrl: string;
  publishedAt: Date;
  source: { name: string; logoUrl: string | null };
};

export type PublicHomeSection = {
  id: string;
  slug: string;
  displayOrder: number;
  layoutType: CategoryHomeLayout;
  themeColor: string;
  articles: PublicHomeArticle[];
};

type PublicHomeRow = {
  categoryId: string;
  slug: string;
  displayOrder: number;
  layoutType: CategoryHomeLayout;
  themeColor: string;
  articleId: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  articleUrl: string;
  publishedAt: Date;
  sourceName: string;
  sourceLogoUrl: string | null;
};

/**
 * Les lignes sont retournées dans l'ordre SQL : catégorie puis publishedAt et id.
 * Le JOIN LATERAL exclut naturellement les catégories vides dans la langue.
 */
export function groupPublicHomeRows(
  rows: readonly PublicHomeRow[],
): PublicHomeSection[] {
  const sections = new Map<string, PublicHomeSection>();

  for (const row of rows) {
    let section = sections.get(row.categoryId);
    if (!section) {
      section = {
        id: row.categoryId,
        slug: row.slug,
        displayOrder: row.displayOrder,
        layoutType: row.layoutType,
        themeColor: row.themeColor,
        articles: [],
      };
      sections.set(row.categoryId, section);
    }

    // Défense supplémentaire : le maximum est défini dans le contrat partagé.
    if (section.articles.length >= CATEGORY_HOME_LAYOUT_CAPACITY[section.layoutType]) {
      continue;
    }

    section.articles.push({
      id: row.articleId,
      title: row.title,
      summary: row.summary,
      imageUrl: row.imageUrl,
      articleUrl: row.articleUrl,
      publishedAt: row.publishedAt,
      source: {
        name: row.sourceName,
        logoUrl: row.sourceLogoUrl,
      },
    });
  }

  return [...sections.values()];
}

@Injectable()
export class PublicHomeService {
  constructor(private readonly database: DatabaseService) {}

  async getHome(locale: string): Promise<{ items: PublicHomeSection[] }> {
    // Une requête bornée : le LATERAL applique le LIMIT dans chaque catégorie
    // via l'index (language_iso_code2, category_id, published_at DESC).
    // Pas de N+1 et aucune lecture non bornée des articles.
    const rows = await this.database.prisma.$queryRaw<PublicHomeRow[]>`
      SELECT
        c.id AS "categoryId",
        c.slug,
        c.display_order AS "displayOrder",
        c.layout_type::text AS "layoutType",
        c.theme_color AS "themeColor",
        recent.id AS "articleId",
        recent.title,
        recent.summary,
        recent.image_url AS "imageUrl",
        recent.article_url AS "articleUrl",
        recent.published_at AS "publishedAt",
        recent.source_name AS "sourceName",
        recent.source_logo_url AS "sourceLogoUrl"
      FROM category AS c
      JOIN LATERAL (
        SELECT
          a.id,
          a.title,
          a.summary,
          a.image_url,
          a.article_url,
          a.published_at,
          s.name AS source_name,
          s.logo_url AS source_logo_url
        FROM article AS a
        INNER JOIN source AS s ON s.id = a.source_id
        WHERE a.category_id = c.id
          AND a.language_iso_code2 = CAST(${locale} AS CHAR(2))
          AND a.article_url ~* '^https?://[^[:space:]]+$'
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT CASE c.layout_type::text
          WHEN 'FEATURED' THEN 5
          WHEN 'GRID' THEN 6
          WHEN 'LIST' THEN 5
          WHEN 'SPLIT' THEN 3
          WHEN 'MOSAIC' THEN 5
          WHEN 'COMPACT' THEN 8
          WHEN 'HEADLINES' THEN 10
          WHEN 'CAROUSEL' THEN 6
          ELSE 0
        END
      ) AS recent ON TRUE
      WHERE c.is_active = TRUE
      ORDER BY c.display_order ASC, recent.published_at DESC, recent.id DESC
    `;

    return { items: groupPublicHomeRows(rows) };
  }
}
