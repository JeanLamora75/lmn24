import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { shouldBlockTvApi } from "./tv/tv-public-gate";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Fail closed even if a public TV controller is added in a later story.
  app.use((
    req: { path: string },
    res: { setHeader(name: string, value: string): void; status(code: number): { send(body: string): void } },
    next: () => void,
  ) => {
    if (shouldBlockTvApi(req.path)) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(404).send("Not Found");
      return;
    }
    next();
  });
  // Horoscopes and bounded TV icon uploads (1 Mo binary => ~1,33 Mo base64).
  // The TV icon endpoint applies its own stricter file-size and format checks.
  app.useBodyParser("json", { limit: "1.5mb" });
  app.enableShutdownHooks();

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("LMN24 API")
    .setDescription("API REST interne de LMN24")
    .setVersion("0.1.0")
    .build();

  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = Number(process.env.BACKEND_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
