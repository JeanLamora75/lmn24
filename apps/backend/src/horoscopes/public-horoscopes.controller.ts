import { BadRequestException, Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  HOROSCOPE_LOCALES, HOROSCOPE_SIGNS, horoscopeWindow, PublicHoroscopesService,
} from "./public-horoscopes.service";

const localeSchema = z.enum(HOROSCOPE_LOCALES);
const signSchema = z.enum(HOROSCOPE_SIGNS);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

@ApiTags("Public Horoscopes")
@Controller("public/horoscopes")
export class PublicHoroscopesController {
  constructor(private readonly service: PublicHoroscopesService) {}

  @Get("calendar")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Eight civil dates from today in Europe/Paris" })
  calendar() {
    return { timezone: "Europe/Paris", dates: horoscopeWindow(), signs: HOROSCOPE_SIGNS };
  }

  @Get(":sign")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Horoscope for a sign, language and date (J through J+7)" })
  async get(
    @Param("sign") rawSign: unknown,
    @Query("locale") rawLocale: unknown,
    @Query("date") rawDate?: unknown,
  ) {
    const sign = signSchema.safeParse(rawSign);
    const locale = localeSchema.safeParse(rawLocale);
    const dates = horoscopeWindow();
    const date = rawDate === undefined ? dates[0] : rawDate;
    const day = daySchema.safeParse(date);
    if (!sign.success || !locale.success || !day.success || !dates.includes(day.data)) {
      throw new BadRequestException("Paramètres d'horoscope invalides (signe, langue ou date J à J+7).");
    }
    return this.service.get(sign.data, locale.data, day.data);
  }
}
