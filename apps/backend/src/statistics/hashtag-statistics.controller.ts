import {
  BadRequestException, Controller, ForbiddenException, Get,
  Header, Query, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { HashtagStatisticsService } from "./hashtag-statistics.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const querySchema = z.object({
  period: z.enum(["24h", "7d", "30d"]).default("7d"),
  ids: z.string().max(200).optional(),
}).strict();

@Controller("admin/statistics/hashtags")
export class HashtagStatisticsController {
  private readonly cookieName: string;
  constructor(
    private readonly statistics: HashtagStatisticsService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async dashboard(
    @Req() request: RequestLike,
    @Query() query: Record<string, string | undefined>,
  ) {
    const header = request.headers.cookie;
    const cookies = Array.isArray(header) ? header.join(";") : (header ?? "");
    const token = cookies.split(";").map((x) => x.trim())
      .find((x) => x.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Accès réservé aux administrateurs.");
    }
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Filtres hashtags invalides.");
    const ids = parsed.data.ids ? parsed.data.ids.split(",") : [];
    if (ids.length > 5 || ids.some((id) => !z.uuid().safeParse(id).success) ||
      new Set(ids).size !== ids.length) {
      throw new BadRequestException("Sélectionnez au maximum cinq hashtags distincts.");
    }
    return this.statistics.dashboard(parsed.data.period, ids);
  }
}
