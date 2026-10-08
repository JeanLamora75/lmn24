import {
  BadRequestException,
  Controller,
  Header,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";

import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_COOKIE_NAME,
} from "../auth/auth.constants";
import { AuthService } from "../auth/auth.service";
import { FeedCsvImportService } from "./feed-csv-import.service";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

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
    private readonly feedCsvImportService: FeedCsvImportService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>("SESSION_COOKIE_NAME")?.trim() ||
      DEFAULT_SESSION_COOKIE_NAME;
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
