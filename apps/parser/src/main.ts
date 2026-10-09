import type { ApiErrorResponse, HealthResponse } from "@lmn24/contracts";
import { createPrismaClient } from "@lmn24/database";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

import pino from "pino";
import { z } from "zod";

import { ParserEngine } from "./parser-engine.js";
import {
  ActiveRunError,
  RunManager,
} from "./run-manager.js";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env"));
} catch {
  // Local .env is optional; environment variables may be injected externally.
}

const logger = pino({
  name: "lmn24-parser",
});

const port = Number(process.env.PARSER_PORT ?? 3002);
const configuredSharedSecret =
  process.env.PARSER_SHARED_SECRET?.trim();

if (!configuredSharedSecret) {
  throw new Error("PARSER_SHARED_SECRET is required.");
}

if (
  process.env.NODE_ENV === "production" &&
  configuredSharedSecret === "CHANGE_ME"
) {
  throw new Error(
    "PARSER_SHARED_SECRET must be changed in production.",
  );
}

const sharedSecret: string = configuredSharedSecret;

const filtersSchema = z.object({
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

function authorized(request: IncomingMessage): boolean {
  const supplied = request.headers["x-parser-secret"];

  if (typeof supplied !== "string") {
    return false;
  }

  const expectedBuffer = Buffer.from(sharedSecret);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function writeApiError(
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
): void {
  const error: ApiErrorResponse = {
    statusCode,
    code,
    message,
    timestamp: new Date().toISOString(),
  };

  writeJson(response, statusCode, error);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);
    size += buffer.length;

    if (size > 64 * 1024) {
      throw new Error("Request body too large.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function bootstrap(): Promise<void> {
  const database = createPrismaClient();
  await database.$connect();

  const engine = new ParserEngine(database);
  const runs = new RunManager(engine);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(
        request.url ?? "/",
        "http://localhost:" + port,
      );

      if (request.method === "GET" && url.pathname === "/health") {
        const health: HealthResponse = {
          status: "ok",
          service: "parser",
        };

        writeJson(response, 200, health);
        return;
      }

      if (!authorized(request)) {
        writeApiError(
          response,
          401,
          "UNAUTHORIZED",
          "Parser authentication failed.",
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/runs") {
        const rawBody = await readJson(request);
        const parsed = filtersSchema.safeParse(rawBody);

        if (!parsed.success) {
          writeApiError(
            response,
            400,
            "INVALID_FILTERS",
            "Invalid parser filters.",
          );
          return;
        }

        try {
          const runId = runs.start(parsed.data);

          writeJson(response, 202, { runId });
        } catch (error) {
          if (error instanceof ActiveRunError) {
            writeApiError(
              response,
              409,
              "RUN_ALREADY_ACTIVE",
              error.message,
            );
            return;
          }

          throw error;
        }

        return;
      }

      const eventMatch = url.pathname.match(
        /^\/runs\/([0-9a-f-]+)\/events$/,
      );

      if (request.method === "GET" && eventMatch?.[1]) {
        const runId = eventMatch[1];

        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });

        const subscription = runs.subscribe(runId, (event) => {
          response.write("data: " + JSON.stringify(event) + "\n\n");

          if (
            event.type === "run-completed" ||
            event.type === "run-error"
          ) {
            response.end();
          }
        });

        if (!subscription) {
          response.end(
            "data: " +
              JSON.stringify({
                type: "run-error",
                timestamp: new Date().toISOString(),
                message: "Exécution introuvable.",
              }) +
              "\n\n",
          );
          return;
        }

        for (const event of subscription.events) {
          response.write("data: " + JSON.stringify(event) + "\n\n");
        }

        if (subscription.done) {
          subscription.unsubscribe();
          response.end();
          return;
        }

        const keepAlive = setInterval(() => {
          if (!response.writableEnded) {
            response.write(": keep-alive\n\n");
          }
        }, 15_000);

        const cleanup = () => {
          clearInterval(keepAlive);
          subscription.unsubscribe();
        };

        request.on("close", cleanup);
        response.on("close", cleanup);
        return;
      }

      writeApiError(
        response,
        404,
        "NOT_FOUND",
        "Route not found",
      );
    } catch (error) {
      logger.error({ error }, "Parser request failed");

      if (!response.headersSent) {
        writeApiError(
          response,
          500,
          "INTERNAL_ERROR",
          "Parser request failed.",
        );
      } else if (!response.writableEnded) {
        response.end();
      }
    }
  });

  server.listen(port, () => {
    logger.info({ port }, "LMN24 parser started");
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "LMN24 parser shutting down");

    server.close(async (error) => {
      await database.$disconnect();

      if (error) {
        logger.error({ error }, "Parser shutdown failed");
        process.exit(1);
      }

      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap().catch((error) => {
  logger.fatal({ error }, "LMN24 parser failed to start");
  process.exit(1);
});
