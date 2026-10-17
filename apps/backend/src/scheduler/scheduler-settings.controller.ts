import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Get, Header, Patch, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { DatabaseService } from "../database/database.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const parser = z.enum(["INFOS", "VIDEOS", "WEATHER", "HOROSCOPE_IMPORT"]);
const input = z.object({
  parserType: parser,
  isEnabled: z.boolean(),
  intervalMinutes: z.number().int().min(15).max(1440).nullable(),
  localTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).nullable(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

@Controller("admin/scheduler-settings")
export class SchedulerSettingsController {
  private readonly cookieName: string;
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
  }
  private async assertAdmin(req: RequestLike): Promise<void> {
    const raw = req.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : raw ?? "";
    const token = cookie.split(";").map(x => x.trim())
      .find(x => x.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") throw new ForbiddenException("Accès réservé aux administrateurs.");
  }
  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Req() req: RequestLike) {
    await this.assertAdmin(req);
    return { configured: await this.db.prisma.schedulerConfig.findMany({
      orderBy: { parserType: "asc" },
    }), schedulerActive: false };
  }
  @Patch()
  @Header("Cache-Control", "no-store")
  async update(@Req() req: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(req);
    const parsed = input.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Configuration invalide.");
    const item = parsed.data;
    const horoscope = item.parserType === "HOROSCOPE_IMPORT";
    if (horoscope
      ? item.intervalMinutes !== null || !item.localTime || item.localTime < "06:00"
      : item.intervalMinutes === null || item.localTime !== null) {
      throw new BadRequestException("Intervalle ou horaire incompatible avec ce parser.");
    }
    const previous = await this.db.prisma.schedulerConfig.findUnique({
      where: { parserType: item.parserType },
    });
    if (!previous || previous.updatedAt.toISOString() !== new Date(item.expectedUpdatedAt).toISOString()) {
      throw new ConflictException("Les paramètres ont changé. Actualisez la page.");
    }
    // PostgreSQL stores microseconds, whereas JavaScript Date has millisecond precision.
    // Match the DB timestamp within the original millisecond to avoid false conflicts.
    const updatedAtMs = previous.updatedAt.getTime();
    const result = await this.db.prisma.schedulerConfig.updateMany({
      where: {
        parserType: item.parserType,
        updatedAt: {
          gte: new Date(updatedAtMs),
          lt: new Date(updatedAtMs + 1),
        },
      },
      data: {
        isEnabled: item.isEnabled,
        intervalMinutes: item.intervalMinutes,
        localTime: item.localTime,
        nextDueAt: null,
        lastScheduledAt: null,
      },
    });
    if (result.count !== 1) throw new ConflictException("Modification concurrente. Rechargez les paramètres.");
    return this.db.prisma.schedulerConfig.findUniqueOrThrow({
      where: { parserType: item.parserType },
    });
  }
}
