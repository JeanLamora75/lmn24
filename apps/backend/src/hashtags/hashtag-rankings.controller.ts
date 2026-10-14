import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { HashtagTrendsService } from "./hashtag-trends.service";
import { DatabaseService } from "../database/database.service";

const filters = z.object({
  period: z.enum(["24h", "7d", "30d"]).default("24h"),
  mode: z.enum(["most-cited", "trending"]).default("most-cited"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

@Controller("hashtags")
export class HashtagRankingsController {
  constructor(private readonly trends: HashtagTrendsService, private readonly db: DatabaseService) {}

  /** Public read-only ranking API used by the locale-aware listing page. */
  @Get("rankings")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  async rankings(@Query() raw: Record<string, string | undefined>) {
    const parsed = filters.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filtres de classement invalides.");
    return this.trends.rank(parsed.data);
  }

  /** Minimal public subject profile; full article listing follows in SCRUM-55. */
  @Get(":slug")
  @Header("Cache-Control", "public, max-age=60")
  async subject(@Param("slug") slug: string) {
    if (slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new NotFoundException("Hashtag introuvable.");
    }
    const subject = await this.db.prisma.hashtag.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true, name: true, imageUrl: true },
    });
    if (!subject) throw new NotFoundException("Hashtag introuvable.");
    return subject;
  }
}
