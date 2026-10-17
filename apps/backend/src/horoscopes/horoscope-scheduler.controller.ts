import { Controller, Header, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { HoroscopeImportService } from "./horoscope-import.service";

type RequestLike = { headers: Record<string, string | string[] | undefined> };

/**
 * Parser-to-backend private endpoint, not exposed as an administrator action.
 * Requires SCHEDULER_INTERNAL_SECRET distinct from session authentication.
 * Does not bypass the Horoscope service's shared PostgreSQL parser lock.
 */
@Controller("internal/scheduler/horoscope")
export class HoroscopeSchedulerController {
  private readonly secret: string;
  constructor(
    private readonly horoscope: HoroscopeImportService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>("SCHEDULER_INTERNAL_SECRET")?.trim() ?? "";
  }

  @Post("import")
  @Header("Cache-Control", "no-store")
  async run(@Req() request: RequestLike) {
    const header = request.headers["x-scheduler-secret"];
    if (!this.secret || typeof header !== "string") {
      throw new UnauthorizedException("Scheduler authentication required.");
    }
    const expected = Buffer.from(this.secret);
    const actual = Buffer.from(header);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException("Scheduler authentication failed.");
    }
    return this.horoscope.importScheduledAvailable();
  }
}
