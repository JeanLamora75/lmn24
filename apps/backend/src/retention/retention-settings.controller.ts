import {
  BadRequestException, Body, Controller, ForbiddenException,
  Get, Header, Patch, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RETENTION_MAX_DAYS } from "@lmn24/contracts";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { RetentionSettingsService } from "./retention-settings.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const days = z.number().int().min(1).max(RETENTION_MAX_DAYS);
const changeSchema = z.object({
  key: z.string().min(1).max(128),
  days,
  expectedDays: days,
  confirmDecrease: z.boolean(),
}).strict();

@Controller("admin/retention-settings")
export class RetentionSettingsController {
  private readonly cookieName: string;

  constructor(
    private readonly retention: RetentionSettingsService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }

  private async assertAdmin(request: RequestLike): Promise<void> {
    const raw = request.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : raw ?? "";
    const token = cookie.split(";").map((item) => item.trim()).find(
      (item) => item.startsWith(this.cookieName + "="),
    )?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Accès réservé aux administrateurs.");
    }
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Req() request: RequestLike) {
    await this.assertAdmin(request);
    return this.retention.getAll();
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  async update(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        "Saisissez une clé autorisée et des durées entières comprises entre 1 et 3650 jours.",
      );
    }
    return this.retention.updateOne(parsed.data);
  }
}
