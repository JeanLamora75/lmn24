import {
  BadRequestException, Body, Controller, Delete, ForbiddenException,
  Get, Header, HttpCode, Param, Patch, Post, Put, Query,
  Req, UnauthorizedException, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { HashtagStatsService } from "./hashtag-stats.service";
import { HashtagsService } from "./hashtags.service";
import { HashtagHistoryService } from "./hashtag-history.service";

const uuid = z.string().uuid();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255);
const alias = z.object({
  name: z.string().trim().min(1).max(255),
  languageIsoCode2: z.string().regex(/^[a-z]{2}$/).nullable().optional(),
}).strict();
const payloadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug,
  isActive: z.boolean(),
  aliases: z.array(alias).max(50),
}).strict();
const statusSchema = z.object({ isActive: z.boolean() }).strict();
const paginationSchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict();
type RequestLike = { headers: Record<string, string | string[] | undefined> };

@Controller("admin/hashtags")
export class HashtagsController {
  private readonly cookieName: string;
  constructor(
    private readonly hashtags: HashtagsService,
    private readonly stats: HashtagStatsService,
    private readonly history: HashtagHistoryService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim()
      || DEFAULT_SESSION_COOKIE_NAME;
  }

  private async assertAdmin(request: RequestLike) {
    const raw = request.headers.cookie;
    const cookie = Array.isArray(raw) ? raw.join(";") : raw || "";
    const part = cookie.split(";").map((x) => x.trim()).find(
      (x) => x.startsWith(this.cookieName + "="),
    );
    const user = await this.auth.getUserFromSession(part?.slice(this.cookieName.length + 1));
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") throw new ForbiddenException("Accès réservé aux administrateurs.");
  }

  private parseId(id: string) {
    const result = uuid.safeParse(id);
    if (!result.success) throw new BadRequestException("Identifiant de hashtag invalide.");
    return result.data;
  }
  private parseBody(body: unknown) {
    const result = payloadSchema.safeParse(body);
    if (!result.success) throw new BadRequestException("Hashtag ou alias invalide.");
    return result.data;
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Req() request: RequestLike, @Query() raw: Record<string, string | undefined>) {
    await this.assertAdmin(request);
    const parsed = paginationSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filtres de hashtags invalides.");
    return this.hashtags.list(parsed.data);
  }

  @Post()
  @Header("Cache-Control", "no-store")
  async create(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    return this.hashtags.create(this.parseBody(body));
  }

  @Post("warnings")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async warnings(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = z.object({
      hashtag: payloadSchema,
      exceptId: uuid.optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Termes à analyser invalides.");
    return { warnings: await this.hashtags.getWarnings(
      parsed.data.hashtag, parsed.data.exceptId,
    ) };
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  @Header("Cache-Control", "no-store")
  async uploadImage(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    await this.assertAdmin(request);
    const id = this.parseId(rawId);
    if (!file?.buffer) throw new BadRequestException("Aucune image n'a été fournie.");
    return this.hashtags.uploadImage(id, file.buffer);
  }

  @Post(":id/image/import")
  @Header("Cache-Control", "no-store")
  async importImage(
    @Req() request: RequestLike, @Param("id") rawId: string, @Body() body: unknown,
  ) {
    await this.assertAdmin(request);
    const id = this.parseId(rawId);
    const parsed = z.object({
      url: z.string().trim().url().max(2048),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("URL de l'image invalide.");
    return this.hashtags.importImage(id, parsed.data.url);
  }

  @Delete(":id/image")
  @Header("Cache-Control", "no-store")
  async removeImage(@Req() request: RequestLike, @Param("id") rawId: string) {
    await this.assertAdmin(request);
    return this.hashtags.removeImage(this.parseId(rawId));
  }

  @Post(":id/analyze")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async analyze(
    @Req() request: RequestLike, @Param("id") rawId: string, @Body() body: unknown,
  ) {
    await this.assertAdmin(request);
    const id = this.parseId(rawId);
    const parsed = z.object({
      cursor: uuid.optional(),
      asOf: z.string().datetime({ offset: true }).optional(),
      version: z.string().datetime({ offset: true }).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Paramètres d'analyse invalides.");
    return this.history.scanPage(id, parsed.data);
  }

  @Post(":id/rebuild")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  async rebuild(@Req() request: RequestLike, @Param("id") rawId: string) {
    await this.assertAdmin(request);
    const id = this.parseId(rawId);
    await this.hashtags.getById(id);
    this.stats.enqueue(id);
    return { queued: true, id };
  }

  @Get(":id/rebuild")
  @Header("Cache-Control", "no-store")
  async rebuildStatus(@Req() request: RequestLike, @Param("id") rawId: string) {
    await this.assertAdmin(request);
    return this.stats.getStatus(this.parseId(rawId));
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async one(@Req() request: RequestLike, @Param("id") id: string) {
    await this.assertAdmin(request);
    return this.hashtags.getById(this.parseId(id));
  }

  @Put(":id")
  @Header("Cache-Control", "no-store")
  async update(@Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown) {
    await this.assertAdmin(request);
    return this.hashtags.update(this.parseId(id), this.parseBody(body));
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store")
  async status(@Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Statut invalide.");
    return this.hashtags.setActive(this.parseId(id), parsed.data.isActive);
  }

  @Delete(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async remove(@Req() request: RequestLike, @Param("id") id: string) {
    await this.assertAdmin(request);
    return this.hashtags.delete(this.parseId(id));
  }
}
