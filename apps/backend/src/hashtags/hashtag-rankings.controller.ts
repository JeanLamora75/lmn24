import { BadRequestException, Controller, Get, Header, Query } from "@nestjs/common";
import { z } from "zod";
import { HashtagTrendsService } from "./hashtag-trends.service";

const filters = z.object({
  period: z.enum(["24h", "7d", "30d"]).default("24h"),
  mode: z.enum(["most-cited", "trending"]).default("most-cited"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

@Controller("hashtags")
export class HashtagRankingsController {
  constructor(private readonly trends: HashtagTrendsService) {}

  /** Public read-only API. SCRUM-54 will build the UI consuming this. */
  @Get("rankings")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  async rankings(@Query() raw: Record<string, string | undefined>) {
    const parsed = filters.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filtres de classement invalides.");
    return this.trends.rank(parsed.data);
  }
}
