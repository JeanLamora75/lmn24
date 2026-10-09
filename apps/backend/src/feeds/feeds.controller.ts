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
import { FeedCsvImportService } from "./feed-csv-import.service";
import { FeedsService } from "./feeds.service";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

const allowedPageSizes = [5, 10, 25, 50, 100] as const;

const listQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  language: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toLowerCase())
    .optional(),
  categoryId: z.string().uuid().optional(),
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

const feedInputSchema = z.object({
  sourceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  languageIsoCode2: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toLowerCase()),
  feedUrl: httpUrlSchema,
  isActive: z.boolean(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const feedIdSchema = z.string().uuid();

type UploadedCsv = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller("admin/feeds")
export class FeedsController {
  private readonly cookieName: string;

  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedCsvImportService: FeedCsvImportService,
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

    return this.feedsService.list(parsed.data);
  }

  @Get("languages")
  @Header("Cache-Control", "no-store")
  async languages(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);

    return {
      items: await this.feedsService.listLanguages(),
    };
  }

  @Get("categories")
  @Header("Cache-Control", "no-store")
  async categories(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);

    return {
      items: await this.feedsService.listCategories(),
    };
  }

  @Get("export")
  @Header("Cache-Control", "no-store")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);

    return this.feedsService.exportActiveCsv();
  }

  @Get("form-options")
  @Header("Cache-Control", "no-store")
  async formOptions(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);

    return this.feedsService.listFormOptions();
  }

  @Post("csv/analyze")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @Header("Cache-Control", "no-store")
  async analyzeCsv(
    @Req() request: RequestLike,
    @UploadedFile() file?: UploadedCsv,
  ) {
    await this.assertAuthenticated(request);

    if (!file?.buffer) {
      throw new BadRequestException("Aucun fichier CSV n’a été fourni.");
    }

    return this.feedCsvImportService.analyze(
      file.buffer,
      file.originalname,
    );
  }

  @Post("csv/import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @Header("Cache-Control", "no-store")
  async importCsv(
    @Req() request: RequestLike,
    @UploadedFile() file?: UploadedCsv,
  ) {
    await this.assertAuthenticated(request);

    if (!file?.buffer) {
      throw new BadRequestException("Aucun fichier CSV n’a été fourni.");
    }

    return this.feedCsvImportService.import(
      file.buffer,
      file.originalname,
    );
  }

  @Post()
  @Header("Cache-Control", "no-store")
  async create(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const parsed = feedInputSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException("Informations de flux invalides.");
    }

    return this.feedsService.create(parsed.data);
  }

  @Get(":id/delete-impact")
  @Header("Cache-Control", "no-store")
  async deleteImpact(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);

    const id = feedIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de flux invalide.");
    }

    return this.feedsService.getDeleteImpact(id.data);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async getOne(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);

    const id = feedIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de flux invalide.");
    }

    return this.feedsService.getById(id.data);
  }

  @Put(":id")
  @Header("Cache-Control", "no-store")
  async update(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const id = feedIdSchema.safeParse(rawId);
    const parsed = feedInputSchema.safeParse(body);

    if (!id.success || !parsed.success) {
      throw new BadRequestException("Informations de flux invalides.");
    }

    return this.feedsService.update(id.data, parsed.data);
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store")
  async updateStatus(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const id = feedIdSchema.safeParse(rawId);
    const payload = updateStatusSchema.safeParse(body);

    if (!id.success || !payload.success) {
      throw new BadRequestException("Requête de modification invalide.");
    }

    return this.feedsService.updateStatus(
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

    const id = feedIdSchema.safeParse(rawId);

    if (!id.success) {
      throw new BadRequestException("Identifiant de flux invalide.");
    }

    return this.feedsService.delete(id.data);
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
