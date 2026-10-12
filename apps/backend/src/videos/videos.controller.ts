import { BadRequestException, Body, Controller, Get, Header, Param, Patch, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { VideosService } from "./videos.service";

const uuid = z.string().uuid();
const querySchema = z.object({
  search: z.string().trim().max(255).optional(),
  sourceId: uuid.optional(), categoryId: uuid.optional(),
  language: z.string().regex(/^[a-zA-Z]{2}$/).transform(x => x.toLowerCase()).optional(),
  status: z.enum(["all","published","hidden"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine(x => [5,10,25,50,100].includes(x)).default(10),
});
const updateSchema = z.object({
  categoryId: uuid,
  languageIsoCode2: z.string().regex(/^[A-Za-z]{2}$/).transform(x => x.toLowerCase()),
  isPublished: z.boolean(),
}).strict();
const publishSchema = z.object({ isPublished: z.boolean() }).strict();
type RequestLike = { headers: Record<string, string | string[] | undefined> };
@Controller("admin/videos")
export class VideosController {
  private readonly cookieName: string;
  constructor(private readonly service: VideosService, private readonly auth: AuthService, config: ConfigService) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  }
  private async authorize(request: RequestLike) {
    const raw = request.headers.cookie;
    const header = Array.isArray(raw) ? raw.join(";") : (raw ?? "");
    const token = header.split(";").map(s => s.trim()).find(s => s.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    if (!await this.auth.getUserFromSession(token)) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
  }
  private parseId(id: string) {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) throw new BadRequestException("Identifiant vidéo invalide.");
    return parsed.data;
  }
  @Get() @Header("Cache-Control","no-store")
  async list(@Req() req: RequestLike, @Query() raw: Record<string,string|undefined>) {
    await this.authorize(req);
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filtres invalides.");
    return this.service.list(parsed.data);
  }
  @Get("form-options") @Header("Cache-Control","no-store")
  async options(@Req() req: RequestLike) { await this.authorize(req); return this.service.options(); }
  @Get(":id") @Header("Cache-Control","no-store")
  async get(@Req() req: RequestLike, @Param("id") raw: string) {
    await this.authorize(req); return this.service.get(this.parseId(raw));
  }
  @Put(":id") @Header("Cache-Control","no-store")
  async update(@Req() req: RequestLike, @Param("id") raw: string, @Body() body: unknown) {
    await this.authorize(req);
    const id = this.parseId(raw), parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Données vidéo invalides.");
    return this.service.update(id, parsed.data);
  }
  @Patch(":id/publication") @Header("Cache-Control","no-store")
  async publication(@Req() req: RequestLike, @Param("id") raw: string, @Body() body: unknown) {
    await this.authorize(req);
    const id = this.parseId(raw), parsed = publishSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("État de publication invalide.");
    return this.service.publish(id, parsed.data.isPublished);
  }
}
