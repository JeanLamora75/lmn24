import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Header,
  Put, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { HashtagTrendsService } from "./hashtag-trends.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const positive = z.number().int().min(1).max(1_000_000_000);
const settingsSchema = z.object({
  hashtagTrendMinMentions: positive,
  hashtagTrendMinIncrease: positive,
  hashtagTrendScoreFloor: positive,
}).strict();

@Controller("admin/hashtag-trend-settings")
export class HashtagTrendSettingsController {
  private readonly cookieName: string;
  constructor(
    private readonly trends: HashtagTrendsService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }

  private async assertAdmin(request: RequestLike) {
    const raw = request.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : raw ?? "";
    const part = cookie.split(";").map((x) => x.trim()).find(
      (x) => x.startsWith(this.cookieName + "="),
    );
    const user = await this.auth.getUserFromSession(part?.slice(this.cookieName.length + 1));
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") throw new ForbiddenException("Accès réservé aux administrateurs.");
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async getSettings(@Req() request: RequestLike) {
    await this.assertAdmin(request);
    return this.trends.getSettings();
  }

  @Put()
  @Header("Cache-Control", "no-store")
  async updateSettings(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    const data = settingsSchema.safeParse(body);
    if (!data.success) throw new BadRequestException("Les trois seuils doivent être des entiers strictement positifs.");
    return this.trends.updateSettings(data.data);
  }
}
