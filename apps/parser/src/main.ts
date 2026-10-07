import type { ApiErrorResponse, HealthResponse } from "@lmn24/contracts";
import { createServer } from "node:http";
import { resolve } from "node:path";

import pino from "pino";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env"));
} catch {
  // Local .env is optional; defaults are used when it is absent.
}

const logger = pino({
  name: "lmn24-parser",
});

const port = Number(process.env.PARSER_PORT ?? 3002);

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });

    const health: HealthResponse = {
      status: "ok",
      service: "parser",
    };

    response.end(JSON.stringify(health));
    return;
  }

  response.writeHead(404, {
    "content-type": "application/json; charset=utf-8",
  });

  const error: ApiErrorResponse = {
    statusCode: 404,
    code: "NOT_FOUND",
    message: "Route not found",
    timestamp: new Date().toISOString(),
  };

  response.end(JSON.stringify(error));
});

server.listen(port, () => {
  logger.info({ port }, "LMN24 parser started");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "LMN24 parser shutting down");

  server.close((error) => {
    if (error) {
      logger.error({ error }, "Parser shutdown failed");
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
