import { BadRequestException, Controller, Get, Header, Param, Query } from "@nestjs/common";
import { CATEGORY_INITIAL_PAGE_SIZE, CATEGORY_MAX_PAGE_SIZE } from "@lmn24/contracts";
import { z } from "zod";
import { PublicHashtagArticlesService } from "./public-hashtag-articles.service";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255);
const cursorSchema = z.string().min(1).max(256).optional();
const limitSchema = z.coerce.number().int().min(1).max(CATEGORY_MAX_PAGE_SIZE);

@Controller("public/hashtags")
export class PublicHashtagArticlesController {
  constructor(private readonly articles: PublicHashtagArticlesService) {}

  @Get(":slug/articles")
  @Header("Cache-Control", "no-store")
  async list(
    @Param("slug") rawSlug: unknown,
    @Query("cursor") rawCursor?: unknown,
    @Query("limit") rawLimit?: unknown,
  ) {
    const slug = slugSchema.safeParse(rawSlug);
    const cursor = cursorSchema.safeParse(rawCursor);
    const limit = rawLimit === undefined
      ? { success: true as const, data: CATEGORY_INITIAL_PAGE_SIZE }
      : limitSchema.safeParse(rawLimit);
    if (!slug.success || !cursor.success || !limit.success) {
      throw new BadRequestException("Paramètres de hashtag invalides.");
    }
    return this.articles.getArticles(slug.data, cursor.data, limit.data);
  }
}
