import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_COOKIE_NAME,
} from "./auth.constants";
import { AuthService } from "./auth.service";

const loginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

@Controller("auth")
export class AuthController {
  private readonly cookieName: string;
  private readonly secureCookie: boolean;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
    this.secureCookie =
      configService.get<string>("NODE_ENV") === "production";
  }

  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async login(
    @Body() body: unknown,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException("Requête de connexion invalide.");
    }

    const clientAddress =
      request.ip ?? request.socket?.remoteAddress ?? "unknown";
    const rateLimitKey =
      clientAddress + ":" + parsed.data.email.trim().toLowerCase();

    const result = await this.authService.login(
      parsed.data.email,
      parsed.data.password,
      rateLimitKey,
    );

    response.setHeader(
      "Set-Cookie",
      this.buildSessionCookie(result.token, result.maxAgeSeconds),
    );

    return { user: result.user };
  }

  @Get("session")
  @Header("Cache-Control", "no-store")
  async session(@Req() request: RequestLike) {
    const token = this.readCookie(request.headers.cookie, this.cookieName);
    const user = await this.authService.getUserFromSession(token);

    if (!user) {
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    return { user };
  }

  private buildSessionCookie(token: string, maxAgeSeconds: number): string {
    const parts = [
      this.cookieName + "=" + token,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=" + maxAgeSeconds,
    ];

    if (this.secureCookie) {
      parts.push("Secure");
    }

    return parts.join("; ");
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
    const value = source
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);

    return value || undefined;
  }
}
