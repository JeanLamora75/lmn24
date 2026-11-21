import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Header,
  Param, Patch, Post, Put, Query, Req, ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { assertIanaZone, assertOfficialUrl } from "./tv-catalog-policy";
import { TvCatalogService } from "./tv-catalog.service";

const uuid = z.string().uuid();
const safeName = z.string().trim().min(1).max(255);
const number = z.number().int().min(1).max(2147483647).nullable();
const countryUpdate = z.object({
  referenceTimezone: z.string().min(1).max(100),
  isActive: z.boolean(),
  expectedVersion:z.string().min(1).max(100).optional(),
}).strict();
const discovered = z.object({
  countryId: uuid, slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: safeName, websiteUrl: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
}).strict();
const associationUpdate = z.object({
  isActive: z.boolean(), needsReview: z.boolean(),
  manualNumber: number, officialNumber: number, assignedNumber: number,
  defaultVariantId: uuid.nullable(),
  expectedVersion:z.string().min(1).max(100).optional(),
}).strict().refine(
  (p) => !p.isActive || p.manualNumber !== null || p.officialNumber !== null || p.assignedNumber !== null,
  "Active channel requires a national number",
);
const profileUpdate = z.object({
  name: safeName,
  logoUrl: z.string().max(2048).nullable(),
  websiteUrl: z.string().max(2048).nullable(),
  xUrl: z.string().max(2048).nullable(),
  facebookUrl: z.string().max(2048).nullable(),
  instagramUrl: z.string().max(2048).nullable(),
  youtubeUrl: z.string().max(2048).nullable(),
  officialLiveUrl: z.string().max(2048).nullable(),
}).strict();
const broadcastLanguages = z.object({
  languages: z.array(z.string().regex(/^[a-z]{2}(-[A-Za-z0-9]{2,8})*$/)).max(50),
}).strict();

const variantCreate = z.object({
  channelId: uuid, channelCountryId: uuid,
  code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  name: safeName, timezone: z.string().min(1).max(100),
}).strict();

type RequestLike = { headers: Record<string, string | string[] | undefined> };

/** Server-side ADMIN session & independent admin enablement gate.
 * TV catalogue tables are not installed in production under SCRUM-114.
 */
@ApiExcludeController()
@Controller("admin/tv/catalog")
export class TvCatalogController {
  private readonly cookieName: string;
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: TvCatalogService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>("SESSION_COOKIE_NAME")?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  }

  private async assertAdmin(request: RequestLike): Promise<void> {
    const source = Array.isArray(request.headers.cookie)
      ? request.headers.cookie.join(";") : request.headers.cookie;
    const pair = source?.split(";").map((p) => p.trim())
      .find((p) => p.startsWith(this.cookieName + "="));
    const token = pair?.slice(this.cookieName.length + 1);
    const user = await this.auth.getUserFromSession(token);
    if (!user) throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if (user.role !== "ADMIN") throw new ForbiddenException("Administrator permission required");
    if (this.config.get<string>("TV_CATALOG_ADMIN_ENABLED") !== "true") {
      throw new ServiceUnavailableException("TV catalogue administration is not enabled.");
    }
  }

  @Get("countries")
  @Header("Cache-Control", "no-store")
  async listCountries(@Req() request: RequestLike) {
    await this.assertAdmin(request);
    return { items: await this.catalog.listCountries() };
  }

  @Put("countries/:id")
  @Header("Cache-Control", "no-store")
  async upsertCountry(
    @Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown,
  ) {
    await this.assertAdmin(request);
    const parsed = countryUpdate.safeParse(body);
    if (!uuid.safeParse(id).success || !parsed.success) throw new BadRequestException("Invalid TV country");
    try { assertIanaZone(parsed.data.referenceTimezone); }
    catch { throw new BadRequestException("Invalid IANA timezone"); }
    return this.catalog.upsertCountry(id, parsed.data.referenceTimezone, parsed.data.isActive,parsed.data.expectedVersion);
  }

  @Get("channels")
  @Header("Cache-Control", "no-store")
  async listChannels(@Req() request: RequestLike, @Query("countryId") countryId?: string) {
    await this.assertAdmin(request);
    if (countryId && !uuid.safeParse(countryId).success) throw new BadRequestException("Invalid country");
    return { items: await this.catalog.listChannels(countryId) };
  }

  @Post("channels/discover")
  @Header("Cache-Control", "no-store")
  async discoverChannel(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = discovered.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid TV channel");
    try {
      assertOfficialUrl(parsed.data.websiteUrl ?? null);
      assertOfficialUrl(parsed.data.logoUrl ?? null);
    } catch { throw new BadRequestException("Invalid official link"); }
    return this.catalog.discoverChannel(parsed.data);
  }

  @Patch("associations/:id")
  @Header("Cache-Control", "no-store")
  async updateAssociation(@Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = associationUpdate.safeParse(body);
    if (!uuid.safeParse(id).success || !parsed.success) throw new BadRequestException("Invalid TV association");
    return this.catalog.updateAssociation(id, parsed.data);
  }

  @Post("associations/:id/assign-number")
  @Header("Cache-Control", "no-store")
  async assignNextNumber(@Req() request: RequestLike, @Param("id") id: string) {
    await this.assertAdmin(request);
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid TV association");
    return this.catalog.assignNextFreeNumber(id);
  }

  @Patch("channels/:id/profile")
  @Header("Cache-Control", "no-store")
  async updateProfile(@Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = profileUpdate.safeParse(body);
    if (!uuid.safeParse(id).success || !parsed.success) throw new BadRequestException("Invalid TV channel profile");
    try {
      for (const field of ["logoUrl","websiteUrl","xUrl","facebookUrl","instagramUrl","youtubeUrl","officialLiveUrl"] as const) {
        assertOfficialUrl(parsed.data[field]);
      }
    } catch { throw new BadRequestException("Invalid TV official link"); }
    return this.catalog.updateChannelProfile(id, parsed.data);
  }

  @Put("channels/:id/languages")
  @Header("Cache-Control", "no-store")
  async replaceLanguages(@Req() request: RequestLike, @Param("id") id: string, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = broadcastLanguages.safeParse(body);
    if (!uuid.safeParse(id).success || !parsed.success) throw new BadRequestException("Invalid broadcast languages");
    return this.catalog.replaceBroadcastLanguages(id, parsed.data.languages);
  }

  @Post("variants")
  @Header("Cache-Control", "no-store")
  async addVariant(@Req() request: RequestLike, @Body() body: unknown) {
    await this.assertAdmin(request);
    const parsed = variantCreate.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid TV variant");
    try { assertIanaZone(parsed.data.timezone); }
    catch { throw new BadRequestException("Invalid IANA timezone"); }
    return this.catalog.addVariant(parsed.data);
  }
}
