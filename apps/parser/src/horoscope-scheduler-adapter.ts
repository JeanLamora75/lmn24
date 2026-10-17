import type { SchedulerExecutor } from "./scheduler-dispatcher.js";
import { GlobalParserBusyError } from "./global-parser-lock.js";

/**
 * Calls the EXISTING NestJS horoscope importer instead of duplicating its
 * Prisma validation / persistence logic in the parser process.
 * The endpoint itself uses the same global PostgreSQL lease as manual imports.
 *
 * Config:
 *   SCHEDULER_BACKEND_URL=http://127.0.0.1:3001
 *   SCHEDULER_INTERNAL_SECRET=<high-entropy shared secret>
 */
export class HoroscopeFileMissingError extends Error {
  constructor() {
    super("Le fichier Horoscope du jour n'est pas encore disponible.");
    this.name = "HoroscopeFileMissingError";
  }
}

export function horoscopeImportExecutor(
  backendUrl: string,
  secret: string,
): SchedulerExecutor {
  if (!secret || secret.length < 32) {
    throw new Error("SCHEDULER_INTERNAL_SECRET must have at least 32 characters.");
  }
  const target = new URL("/internal/scheduler/horoscope/import", backendUrl);
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
    throw new Error("Horoscope scheduler endpoint must use loopback HTTP.");
  }
  return async () => {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "x-scheduler-secret": secret,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(120_000),
      redirect: "error",
    });
    if (response.status === 404) throw new HoroscopeFileMissingError();
    if (response.status === 409) {
      throw new GlobalParserBusyError();
    }
    if (!response.ok) throw new Error("Horoscope import returned HTTP " + response.status);
    const body = await response.json() as { status?: unknown };
    if (body.status === "SUCCESS") return { status: "SUCCESS" as const };
    if (body.status === "SKIPPED") return { status: "SKIPPED" as const };
    throw new Error("Unexpected horoscope import status.");
  };
}
