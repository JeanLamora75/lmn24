import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { PublicHomeController } from "./public-home.controller";
import {
  groupPublicHomeRows,
  PublicHomeService,
} from "./public-home.service";

const categoryA = "11111111-1111-4111-8111-111111111111";
const categoryB = "22222222-2222-4222-8222-222222222222";

function articleRow(input: {
  categoryId?: string;
  articleId?: string;
  slug?: string;
  displayOrder?: number;
  layoutType?: "GRID" | "SPLIT";
  publishedAt?: string;
}) {
  return {
    categoryId: input.categoryId ?? categoryA,
    slug: input.slug ?? "news",
    displayOrder: input.displayOrder ?? 1,
    layoutType: input.layoutType ?? ("GRID" as const),
    themeColor: "#2563EB",
    articleId: input.articleId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Actualité",
    summary: null,
    imageUrl: null,
    articleUrl: "https://example.org/story",
    publishedAt: new Date(input.publishedAt ?? "2026-10-09T12:00:00.000Z"),
    sourceName: "Média exemple",
    sourceLogoUrl: null,
    sourceCountryIsoCode2: "FR",
  };
}

describe("SCRUM-26 — composition des sections", () => {
  it("exclut les catégories vides quand la requête ne retourne aucune ligne", () => {
    expect(groupPublicHomeRows([])).toEqual([]);
  });

  it("groupe les articles et préserve le classement global des catégories", () => {
    const rows = [
      articleRow({ articleId: "a" }),
      articleRow({ articleId: "b" }),
      articleRow({
        categoryId: categoryB,
        slug: "sports",
        displayOrder: 4,
        articleId: "c",
      }),
    ];
    const result = groupPublicHomeRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(categoryA);
    expect(result[0]?.articles.map((article) => article.id)).toEqual(["a", "b"]);
    expect(result[1]?.slug).toBe("sports");
    expect(result[0]?.articles[0]?.source).toEqual({
      name: "Média exemple",
      logoUrl: null,
      countryIsoCode2: "FR",
    });
  });

  it("ne permet pas de dépasser la capacité du modèle", () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      articleRow({ articleId: String(index), layoutType: "SPLIT" }),
    );
    expect(groupPublicHomeRows(rows)[0]?.articles).toHaveLength(3);
  });

  it("sélectionne la langue avec une seule requête bornée et un tri explicite", async () => {
    const query = vi.fn().mockResolvedValue([
      articleRow({ articleId: "a" }),
      articleRow({ articleId: "b" }),
    ]);
    const service = new PublicHomeService({
      prisma: { $queryRaw: query },
    } as unknown as DatabaseService);

    const response = await service.getHome("fr");
    expect(response.items[0]?.articles).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(1);

    const [sqlPieces, locale] = query.mock.calls[0] as [string[], string];
    const sql = sqlPieces.join("?");
    expect(locale).toBe("fr");
    expect(sql).toContain("JOIN LATERAL");
    expect(sql).toContain("LEFT JOIN country AS source_country ON source_country.id = s.country_id");
    expect(sql).toContain('recent.source_country_iso_code2 AS "sourceCountryIsoCode2"');
    expect(sql).toContain("a.language_iso_code2 = CAST(");
    expect(sql).toContain("ORDER BY a.published_at DESC, a.id DESC");
    expect(sql).toContain("WHERE c.is_active = TRUE");
    expect(sql).toContain("ORDER BY c.display_order ASC");
    expect(sql).not.toContain("created_at");
    expect(sql).toContain("WHEN 'HEADLINES' THEN 10");
    expect(sql).toContain("WHEN 'CAROUSEL' THEN 6");
  });
});

describe("SCRUM-26 — route publique", () => {
  it("accepte une locale reconnue sans session", async () => {
    const getHome = vi.fn().mockResolvedValue({ items: [] });
    const controller = new PublicHomeController({
      getHome,
    } as unknown as PublicHomeService);
    await expect(controller.getHome("fr")).resolves.toEqual({ items: [] });
    expect(getHome).toHaveBeenCalledWith("fr");
  });

  it("rejette une locale inconnue ou une valeur multiple", async () => {
    const getHome = vi.fn();
    const controller = new PublicHomeController({
      getHome,
    } as unknown as PublicHomeService);
    await expect(controller.getHome("FR")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.getHome(["fr", "en"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(getHome).not.toHaveBeenCalled();
  });
});
