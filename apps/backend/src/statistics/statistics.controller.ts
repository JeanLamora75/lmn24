import { BadRequestException, Controller, Get, Header, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { StatisticsService } from "./statistics.service";

const querySchema = z.object({
  period: z.enum(["24h", "7d", "30d", "90d", "custom"]).default("7d"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  countryId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  language: z.string().regex(/^[a-zA-Z]{2}$/).transform((x) => x.toLowerCase()).optional(),
  sourceId: z.uuid().optional(),
}).refine((x) => x.period !== "custom" || (Boolean(x.from) && Boolean(x.to) && x.from! <= x.to!), {
  message: "Période personnalisée invalide.",
});

type RequestLike = { headers: Record<string, string | string[] | undefined> };

@Controller("admin/statistics")
export class StatisticsController {
  private readonly cookieName: string;
  constructor(
    private readonly statistics: StatisticsService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async dashboard(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    const header = request.headers.cookie;
    const cookies = Array.isArray(header) ? header.join(";") : (header ?? "");
    const token = cookies.split(";").map((x) => x.trim())
      .find((x) => x.startsWith(this.cookieName + "="))?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Filtres de statistiques invalides.");
    return this.statistics.dashboard(parsed.data);
  }
}
