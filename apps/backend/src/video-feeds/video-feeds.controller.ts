import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { ParserGatewayService } from "../parser/parser-gateway.service";
import { videoFeedIdSchema, videoFeedInputSchema, videoFeedListSchema, videoFeedStatusSchema } from "./video-feeds.schemas";
import { VideoFeedsService } from "./video-feeds.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };

@Controller("admin/video-feeds")
export class VideoFeedsController {
  private readonly cookieName: string;
  constructor(private readonly service: VideoFeedsService, private readonly auth: AuthService, private readonly parserGateway: ParserGatewayService, config: ConfigService) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  }
  private async requireAuth(request: RequestLike) {
    const raw = request.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : (raw ?? "");
    const token = cookie.split(";").map(x => x.trim())
      .find(x => x.startsWith(this.cookieName + "="))?.slice(this.cookieName.length + 1);
    if (!await this.auth.getUserFromSession(token)) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
  }
  private id(raw: string): string {
    const parsed = videoFeedIdSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Identifiant de flux vidéo invalide.");
    return parsed.data;
  }
  @Get() @Header("Cache-Control", "no-store")
  async list(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    await this.requireAuth(request);
    const parsed = videoFeedListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Filtres invalides.");
    return this.service.list(parsed.data);
  }
  @Get("form-options") @Header("Cache-Control", "no-store")
  async options(@Req() request: RequestLike) { await this.requireAuth(request); return this.service.formOptions(); }
  @Post("collect") @Header("Cache-Control", "no-store")
  async collect(@Req() request: RequestLike, @Body() body: unknown) {
    await this.requireAuth(request);
    const parsed = z.object({ feedId: z.string().uuid().optional() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Filtre de collecte invalide.");
    return this.parserGateway.startVideoRun(parsed.data.feedId);
  }
  @Get(":id") @Header("Cache-Control", "no-store")
  async get(@Req() request: RequestLike, @Param("id") raw: string) {
    await this.requireAuth(request); return this.service.get(this.id(raw));
  }
  @Post() @Header("Cache-Control", "no-store")
  async create(@Req() request: RequestLike, @Body() body: unknown) {
    await this.requireAuth(request);
    const parsed = videoFeedInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Données du flux vidéo invalides.");
    return this.service.create(parsed.data);
  }
  @Put(":id") @Header("Cache-Control", "no-store")
  async update(@Req() request: RequestLike, @Param("id") raw: string, @Body() body: unknown) {
    await this.requireAuth(request);
    const parsed = videoFeedInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Données du flux vidéo invalides.");
    return this.service.update(this.id(raw), parsed.data);
  }
  @Patch(":id/status") @Header("Cache-Control", "no-store")
  async status(@Req() request: RequestLike, @Param("id") raw: string, @Body() body: unknown) {
    await this.requireAuth(request);
    const parsed = videoFeedStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Statut invalide.");
    return this.service.updateStatus(this.id(raw), parsed.data.isActive);
  }
  @Delete(":id") @HttpCode(200) @Header("Cache-Control", "no-store")
  async remove(@Req() request: RequestLike, @Param("id") raw: string) {
    await this.requireAuth(request); return this.service.remove(this.id(raw));
  }
}
