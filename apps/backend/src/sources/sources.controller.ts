import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_COOKIE_NAME,
} from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { SourcesService } from "./sources.service";

const allowedPageSizes = [5, 10, 25, 50, 100] as const;

const listQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  countryId: z.string().uuid().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value) =>
        allowedPageSizes.includes(
          value as (typeof allowedPageSizes)[number],
        ),
      "Taille de page invalide.",
    )
    .default(10),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const sourceIdSchema = z.string().uuid();

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

@Controller("admin/sources")
export class SourcesController {
  private readonly cookieName: string;

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async list(
    @Req() request: RequestLike,
    @Query() query: Record<string, string | undefined>,
  ) {
    await this.assertAuthenticated(request);

    const parsed = listQuerySchema.safeParse(query);

    if (!parsed.success) {
      throw new BadRequestException("Critères de recherche invalides.");
    }

    return this.sourcesService.list(parsed.data);
  }

  @Get("countries")
  @Header("Cache-Control", "no-store")
  async countries(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);
    return {
      items: await this.sourcesService.listCountries(),
    };
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store")
  async updateStatus(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const id = sourceIdSchema.safeParse(rawId);
    const payload = updateStatusSchema.safeParse(body);

    if (!id.success || !payload.success) {
      throw new BadRequestException("Requête de modification invalide.");
    }

    return this.sourcesService.updateStatus(id.data, payload.data.isActive);
  }

  private async assertAuthenticated(request: RequestLike): Promise<void> {
    const token = this.readCookie(request.headers.cookie, this.cookieName);
    const user = await this.authService.getUserFromSession(token);

    if (!user) {
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }
  }

  private readCookie(
    cookieHeader: string | string[] | undefined,
    cookieName: string,
  ): string | undefined {
    const source = Array.isArray(cookieHeader)
      ? cookieHeader.join(";")
      : cookieHeader;

    if (!source) {
      return undefined;
    }

    const prefix = cookieName + "=";

    return source
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);
  }
}
