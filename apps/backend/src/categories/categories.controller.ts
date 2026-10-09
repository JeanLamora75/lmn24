import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Put,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CATEGORY_HOME_LAYOUTS } from "@lmn24/contracts";
import { z } from "zod";

import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_COOKIE_NAME,
} from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { CategoriesService } from "./categories.service";

const categoryIdSchema = z.string().uuid();

const homeDisplaySchema = z
  .object({
    layoutType: z.enum(CATEGORY_HOME_LAYOUTS),
    themeColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((value) => value.toUpperCase()),
  })
  .strict();

const homeOrderSchema = z
  .object({
    categoryIds: z.array(z.string().uuid()).max(500),
    expectedOrder: z.array(z.string().uuid()).max(500),
  })
  .strict();

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

@Controller("admin/categories")
export class CategoriesController {
  private readonly cookieName: string;

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
  }

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Req() request: RequestLike) {
    await this.assertAuthenticated(request);

    return {
      items: await this.categoriesService.list(),
    };
  }

  @Put("home-order")
  @Header("Cache-Control", "no-store")
  async saveHomeOrder(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);
    const parsed = homeOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Classement de catégories invalide.");
    }
    return {
      items: await this.categoriesService.reorder(
        parsed.data.categoryIds,
        parsed.data.expectedOrder,
      ),
    };
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  async getById(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
  ) {
    await this.assertAuthenticated(request);
    const id = categoryIdSchema.safeParse(rawId);
    if (!id.success) {
      throw new BadRequestException("Identifiant de catégorie invalide.");
    }
    return this.categoriesService.getById(id.data);
  }

  @Patch(":id/home-display")
  @Header("Cache-Control", "no-store")
  async saveHomeDisplay(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);
    const id = categoryIdSchema.safeParse(rawId);
    const parsed = homeDisplaySchema.safeParse(body);
    if (!id.success || !parsed.success) {
      throw new BadRequestException("Configuration de catégorie invalide.");
    }
    return this.categoriesService.updateHomeDisplay(
      id.data,
      parsed.data.layoutType,
      parsed.data.themeColor,
    );
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store")
  async updateStatus(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const id = categoryIdSchema.safeParse(rawId);
    const payload = updateStatusSchema.safeParse(body);

    if (!id.success || !payload.success) {
      throw new BadRequestException("Requête de modification invalide.");
    }

    return this.categoriesService.updateStatus(
      id.data,
      payload.data.isActive,
    );
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
