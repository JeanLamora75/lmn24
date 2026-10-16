import { BadRequestException, Controller, Get, Header, Query } from "@nestjs/common";
import { z } from "zod";
import { PublicWeatherService } from "./public-weather.service";

const weatherQuery = z.object({
  continent: z.enum(["EU", "AS", "AF", "NA", "SA", "OC"]).default("EU"),
}).strict();

/**
 * Public read-only endpoint. No login, cookie or provider call is required.
 * Each response is identical for all visitors choosing the same continent.
 */
@Controller("weather")
export class PublicWeatherController {
  constructor(private readonly weather: PublicWeatherService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=30, stale-while-revalidate=30")
  async list(@Query() query: Record<string, string | string[] | undefined>) {
    const parsed = weatherQuery.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Continent météo invalide (EU, AS, AF, NA, SA, OC).");
    }
    return this.weather.list(parsed.data.continent);
  }
}
