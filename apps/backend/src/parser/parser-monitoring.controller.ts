import {
  BadRequestException, Controller, ForbiddenException, Get, Header,
  Param, Query, Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { ParserMonitoringService } from "./parser-monitoring.service";
import { WeatherMonitoringService } from "./weather-monitoring.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };
const schema = z.object({
  parser: z.enum(["ALL","INFOS","VIDEOS"]).default("ALL"),
  period: z.enum(["24h","7d","30d","custom"]).default("24h"),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  status: z.enum(["ALL","RUNNING","SUCCESS","ERROR","INTERRUPTED"]).default("ALL"),
  search: z.string().trim().max(120).optional(),
  countryId: z.uuid().optional(), categoryId: z.uuid().optional(),
  language: z.string().regex(/^[a-zA-Z]{2}$/).transform(s => s.toLowerCase()).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().refine(n => [20,50,100].includes(n)).default(20),
}).strict();

const weatherSchema = z.object({
  period: z.enum(["24h","7d","30d","custom"]).default("24h"),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  status: z.enum(["ALL","RUNNING","SUCCESS","PARTIAL","ERROR","INTERRUPTED"]).default("ALL"),
  continent: z.enum(["ALL","EU","AS","AF","NA","SA","OC"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().refine(n => [20,50,100].includes(n)).default(20),
}).strict();

const eventSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().refine(n => [20,50,100].includes(n)).default(20),
  errorsOnly: z.enum(["true","false"]).default("false"),
}).strict();

@Controller("admin/parser-monitoring")
export class ParserMonitoringController {
  private readonly cookieName: string;
  constructor(
    private readonly monitoring: ParserMonitoringService,
    private readonly weather: WeatherMonitoringService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }
  private async assertAdmin(request: RequestLike): Promise<void> {
    const header = request.headers.cookie;
    const cookie = Array.isArray(header) ? header.join(";") : header ?? "";
    const token = cookie.split(";").map(x => x.trim())
      .find(x => x.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") throw new ForbiddenException("Administration uniquement.");
  }
  private parse(query: Record<string,string | undefined>) {
    const parsed = schema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Filtres de supervision invalides.");
    return parsed.data;
  }
  @Get("weather")
  @Header("Cache-Control","no-store")
  async weatherOverview(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    const parsed=weatherSchema.safeParse(q);
    if(!parsed.success)throw new BadRequestException("Filtres de supervision météo invalides.");
    return this.weather.overview(parsed.data);
  }

  @Get("summary")
  @Header("Cache-Control","no-store")
  async summary(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    return this.monitoring.summary(this.parse(q));
  }
  @Get("runs")
  @Header("Cache-Control","no-store")
  async runs(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    return this.monitoring.runs(this.parse(q));
  }
  @Get("runs/:type/:id")
  @Header("Cache-Control","no-store")
  async runDetail(@Req() request: RequestLike, @Param("type") type: string, @Param("id") id: string) {
    await this.assertAdmin(request);
    if (!["INFOS","VIDEOS"].includes(type) || !z.uuid().safeParse(id).success)
      throw new BadRequestException("Exécution invalide.");
    return this.monitoring.runDetail(id, type as "INFOS" | "VIDEOS");
  }
  @Get("batches")
  @Header("Cache-Control","no-store")
  async batches(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    return this.monitoring.batches(this.parse(q));
  }
  @Get("batches/:id/events")
  @Header("Cache-Control","no-store")
  async events(@Req() request: RequestLike, @Param("id") id: string, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Identifiant invalide.");
    const parsed = eventSchema.safeParse(q);
    if (!parsed.success) throw new BadRequestException("Pagination des événements invalide.");
    return this.monitoring.events(id, parsed.data.page, parsed.data.pageSize, parsed.data.errorsOnly === "true");
  }
  @Get("alerts")
  @Header("Cache-Control","no-store")
  async alerts(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    return this.monitoring.alerts(this.parse(q));
  }
  @Get("export")
  @Header("Cache-Control","no-store")
  @Header("Content-Type","text/csv; charset=utf-8")
  @Header("Content-Disposition","attachment; filename=parser-runs.csv")
  async exportCsv(@Req() request: RequestLike, @Query() q: Record<string,string | undefined>) {
    await this.assertAdmin(request);
    return this.monitoring.exportCsv(this.parse(q));
  }
}
