import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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
import { CategoriesService } from "./categories.service";

const sourceIdSchema = z.string().uuid();

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
