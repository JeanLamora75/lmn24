import {
  BadRequestException, Body, Controller, ForbiddenException,
  Get, Header, HttpCode, Post, Query, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import {
  isPurgeTable, ManualPurgeService, PURGE_TABLES, type PurgeMode,
} from "./manual-purge.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const modeSchema = z.enum(["expired", "all"]);
const tableSchema = z.enum(PURGE_TABLES);
const runSchema = z.object({
  token: z.string().uuid(),
  table: tableSchema,
  mode: modeSchema,
  confirmed: z.literal(true),
  typedName: z.string().max(80).optional(),
}).strict();

@Controller("admin/manual-purge")
export class ManualPurgeController {
  private readonly cookieName: string;

  constructor(
    private readonly purge: ManualPurgeService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }

  private async assertAdmin(request: RequestLike): Promise<string> {
    const raw = request.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : raw ?? "";
    const token = cookie.split(";").map(s => s.trim())
      .find(s => s.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Accès réservé aux administrateurs.");
    }
    return user.id;
  }

  @Get("tables")
  @Header("Cache-Control", "no-store")
  async tables(@Req() request: RequestLike) {
    await this.assertAdmin(request);
    return { tables: PURGE_TABLES };
  }

  @Get("preview")
  @Header("Cache-Control", "no-store")
  async preview(
    @Req() request: RequestLike,
    @Query("table") table: string,
    @Query("mode") mode: string,
  ) {
    const ownerId = await this.assertAdmin(request);
    if (!isPurgeTable(table) || !modeSchema.safeParse(mode).success) {
      throw new BadRequestException("Sélection de table ou de mode invalide.");
    }
    return this.purge.preview(ownerId, table, mode as PurgeMode);
  }

  @Post("execute")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  async execute(@Req() request: RequestLike, @Body() body: unknown) {
    const ownerId = await this.assertAdmin(request);
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Confirmation de purge invalide.");
    return this.purge.start(ownerId, parsed.data);
  }

  @Get("jobs")
  @Header("Cache-Control", "no-store")
  async jobs(@Req() request: RequestLike) {
    await this.assertAdmin(request);
    return { jobs: this.purge.recentJobs() };
  }
}
