import {
  BadRequestException, Body, Controller, Delete, ForbiddenException,
  Get, Header, HttpCode, Param, Patch, Post, Put, Query,
  Req, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { HashtagsService } from "./hashtags.service";

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
