import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";

import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_COOKIE_NAME,
} from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { SourceCaptureService } from "./source-capture.service";
import { SourceMediaService } from "./source-media.service";
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

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });

const sourceInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  websiteUrl: httpUrlSchema,
  countryIsoCode2: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  isActive: z.boolean(),
  logoUrl: z.string().trim().max(2048).nullable().optional(),
});

const captureSchema = z.object({
  websiteUrl: httpUrlSchema,
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const sourceIdSchema = z.string().uuid();

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller("admin/sources")
export class SourcesController {
  private readonly cookieName: string;

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly mediaService: SourceMediaService,
    private readonly captureService: SourceCaptureService,
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

  @Get("form-countries")
  @Header("Cache-Control", "no-store")
  async formCountries(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);
    return {
      items: await this.sourcesService.listFormCountries(),
    };
  }

  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  @Header("Cache-Control", "no-store")
  async uploadImage(
    @Req() request: RequestLike,
    @UploadedFile() file?: UploadedImage,
  ) {
    await this.assertAuthenticated(request);

    if (!file?.buffer) {
      throw new BadRequestException("Aucune image n’a été fournie.");
    }

    return {
      logoUrl: await this.mediaService.storeImage(
        file.buffer,
        file.mimetype,
      ),
    };
  }

  @Post("capture")
  @Header("Cache-Control", "no-store")
  async capture(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const parsed = captureSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException("URL du site invalide.");
    }

    return {
      logoUrl: await this.captureService.capture(
        parsed.data.websiteUrl,
      ),
    };
  }

  @Post()
  @Header("Cache-Control", "no-store")
  async create(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const parsed = sourceInputSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException("Informations de source invalides.");
    }

    return this.sourcesService.create(parsed.data);
  }

  @Get(":id/delete-impact")
  @Header("Cache-Control", "no-store")
  async deleteImpact(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);

    const id = sourceIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de source invalide.");
    }

    return this.sourcesService.getDeleteImpact(id.data);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async getOne(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);

    const id = sourceIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de source invalide.");
    }

    return this.sourcesService.getById(id.data);
  }

  @Put(":id")
  @Header("Cache-Control", "no-store")
  async update(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const id = sourceIdSchema.safeParse(rawId);
    const parsed = sourceInputSchema.safeParse(body);

    if (!id.success || !parsed.success) {
      throw new BadRequestException("Informations de source invalides.");
    }

    return this.sourcesService.update(id.data, parsed.data);
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

    return this.sourcesService.updateStatus(
      id.data,
      payload.data.isActive,
    );
  }

  @Delete(":id")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async remove(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);

    const id = sourceIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de source invalide.");
    }

    return this.sourcesService.delete(id.data);
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
