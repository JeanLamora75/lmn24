import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
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
} from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { ParserGatewayService } from "./parser-gateway.service";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type StreamResponse = {
  setHeader(name: string, value: string): void;
  write(chunk: Uint8Array | string): boolean;
  end(): void;
};

const startSchema = z.object({
  countryIsoCode2: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  languageIsoCode2: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toLowerCase())
    .optional(),
  categoryId: z.string().uuid().optional(),
});

const runIdSchema = z.string().uuid();

@Controller("admin/parser")
export class ParserController {
  private readonly cookieName: string;

  constructor(
    private readonly parserGateway: ParserGatewayService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
  }

  @Post("runs")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  async start(
    @Req() request: RequestLike,
    @Body() body: unknown,
  ) {
    await this.assertAuthenticated(request);

    const parsed = startSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(
        "Critères de lancement du parser invalides.",
      );
    }

    return this.parserGateway.startRun(parsed.data);
  }

  @Get("runs/:id/events")
  async events(
    @Req() request: RequestLike,
    @Param("id") rawId: string,
    @Res() response: StreamResponse,
  ): Promise<void> {
    await this.assertAuthenticated(request);

    const runId = runIdSchema.safeParse(rawId);

    if (!runId.success) {
      throw new BadRequestException(
        "Identifiant d’exécution invalide.",
      );
    }

    const upstream = await this.parserGateway.openEvents(runId.data);
    const reader = upstream.body!.getReader();

    response.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8",
    );
    response.setHeader("Cache-Control", "no-cache, no-store");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");

    try {
      while (true) {
        const result = await reader.read();

        if (result.done) {
          break;
        }

        response.write(result.value);
      }
    } finally {
      response.end();
    }
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
