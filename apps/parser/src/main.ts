import type { ApiErrorResponse, HealthResponse } from "@lmn24/contracts";
import { createPrismaClient, rebuildHashtagHourlyCounts, type RebuildOptions } from "@lmn24/database";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

import pino from "pino";
import cron from "node-cron";
import { z } from "zod";

import { ParserEngine } from "./parser-engine.js";
import { existingParserAdapters } from "./existing-parser-adapters.js";
import { dispatchOneSchedulerJob, type SchedulerExecutors } from "./scheduler-dispatcher.js";
import { reconcileSchedulerQueue } from "./scheduler-queue.js";
import { horoscopeImportExecutor } from "./horoscope-scheduler-adapter.js";
import { acquireGuardedParserLease } from "./guarded-parser-lease.js";
import { GlobalParserBusyError } from "./global-parser-lock.js";
import { PersistentRunLog } from "./persistent-run-log.js";
import { VideoParserEngine, type VideoParserFilters } from "./video-parser-engine.js";
import { WeatherParserEngine, WeatherRunActiveError } from "./weather-parser-engine.js";
import { weatherFiltersSchema } from "./weather-parser-data.js";
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
  const infoLog = new PersistentRunLog(database, "INFOS");
  const videoLog = new PersistentRunLog(database, "VIDEOS");
  // Recover only stale, unclosed batches. Never invent a SUCCESS for a crashed run.
  const [infoInterrupted, videoInterrupted] = await Promise.all([
    infoLog.recoverInterrupted(), videoLog.recoverInterrupted(),
  ]);
  if (infoInterrupted + videoInterrupted) {
    logger.warn({ infoInterrupted, videoInterrupted }, "Recovered interrupted parser batches");
  }
  const runs = new RunManager(engine, infoLog);
  const videoEngine = new VideoParserEngine(database);
  const videoRuns = new RunManager<VideoParserFilters>(videoEngine, videoLog);
  const weatherEngine = new WeatherParserEngine(database);

  // Every parser entry point MUST use these wrappers; acquired lease ownership
  // moves to the manager and is released only after engine completion.
  async function startInfos(filters: Parameters<typeof runs.start>[0], trigger: "MANUAL" | "AUTOMATIC") {
    const lease = await acquireGuardedParserLease();
    try { return runs.start(filters, trigger, lease); }
    catch (error) { await lease.release(); throw error; }
  }
  async function startVideos(filters: VideoParserFilters, trigger: "MANUAL" | "AUTOMATIC") {
    const lease = await acquireGuardedParserLease();
    try { return videoRuns.start(filters, trigger, lease); }
    catch (error) { await lease.release(); throw error; }
  }
  async function startWeather(filters: Parameters<typeof weatherEngine.start>[0], trigger: "MANUAL" | "AUTOMATIC") {
    const lease = await acquireGuardedParserLease();
    try { return await weatherEngine.start(filters, trigger, lease); }
    catch (error) { await lease.release(); throw error; }
  }

  // Integration seam for SCRUM-84. Existing launch wrappers already acquire
  // and retain the same global lock used by the manual endpoints.
  // DO NOT install a dispatcher timer until the Horoscope backend bridge,
  // recovery policy and PostgreSQL integration tests are completed.
  const parserAdapters = existingParserAdapters(runs, videoRuns, weatherEngine, {
    infos: () => startInfos({}, "AUTOMATIC"),
    videos: () => startVideos({}, "AUTOMATIC"),
    weather: () => startWeather({}, "AUTOMATIC"),
  });
  const scheduledCollectExecutors: Pick<SchedulerExecutors, "INFOS" | "VIDEOS" | "WEATHER"> = {
    INFOS: parserAdapters.INFOS,
    VIDEOS: parserAdapters.VIDEOS,
    WEATHER: parserAdapters.WEATHER,
  };
  // This runner is restricted to non-production integration experiments.
  // The administrator API still refuses activation of scheduler config rows.
  const schedulerExperiment = process.env.NODE_ENV !== "production" &&
    process.env.SCHEDULER_EXPERIMENTAL_RUN === "true";
  let schedulerTimer: ReturnType<typeof setInterval> | undefined;
  if (schedulerExperiment) {
    const secret = process.env.SCHEDULER_INTERNAL_SECRET ?? "";
    const backendUrl = process.env.SCHEDULER_BACKEND_URL ?? "http://127.0.0.1:3001";
    const executors: SchedulerExecutors = {
      ...scheduledCollectExecutors,
      HOROSCOPE_IMPORT: horoscopeImportExecutor(backendUrl, secret),
    };
    let runningTick = false;
    const tick = async () => {
      if (runningTick) return;
      runningTick = true;
      try {
        await reconcileSchedulerQueue(database);
        await dispatchOneSchedulerJob(database, executors);
      } catch (error) {
        logger.error({ error }, "Experimental scheduler tick failed");
      } finally {
        runningTick = false;
      }
    };
    schedulerTimer = setInterval(() => { void tick(); }, 30_000);
    logger.warn("Experimental scheduler enabled in NON-PRODUCTION only");
  }


  let rebuildingStats = false;
  let lastStatsResult: {
    finishedAt: string | null;
    error: string | null;
    rebuiltBuckets: number | null;
  } = { finishedAt: null, error: null, rebuiltBuckets: null };

  // A transaction-level PostgreSQL advisory lock serializes this rebuild
  // with RSS inserts and hashtag administration, even across processes.
  async function runStatsRebuild(options: RebuildOptions): Promise<boolean> {
    if (rebuildingStats) return false;
    rebuildingStats = true;
    try {
      const result = await rebuildHashtagHourlyCounts(database, options);
      lastStatsResult = {
        finishedAt: new Date().toISOString(),
        error: null,
        rebuiltBuckets: result.countedBuckets,
      };
      logger.info({ result }, "Hashtag hourly statistics rebuilt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      lastStatsResult = {
        finishedAt: new Date().toISOString(),
        error: message,
        rebuiltBuckets: null,
      };
      logger.error({ error }, "Hashtag hourly rebuild failed; next schedule will retry");
    } finally {
      rebuildingStats = false;
    }
    return true;
  }

  // Frequent small reconciliation catches late RSS arrivals and out-of-band
  // corrections. A daily full reconciliation heals deletions and missed jobs.
  const hourlyStatsJob = cron.schedule("10 * * * *", () => {
    void runStatsRebuild({ from: new Date(Date.now() - 48 * 3_600_000) });
  }, { timezone: "Etc/UTC" });
  const fullStatsJob = cron.schedule("35 3 * * *", () => {
    void runStatsRebuild({});
  }, { timezone: "Etc/UTC" });

  // Automatic parser schedules are opt-in and run only when configured.
  // Never silently start an hourly collection on an existing installation.
  const scheduledJobs: Array<{ stop(): void }> = [];
  for (const schedule of [
    { expression: process.env.PARSER_INFOS_CRON, type: "INFOS" },
    { expression: process.env.PARSER_VIDEOS_CRON, type: "VIDEOS" },
  ] as const) {
    if (!schedule.expression?.trim()) continue;
    if (!cron.validate(schedule.expression)) {
      throw new Error("Invalid " + schedule.type + " parser cron expression.");
    }
    scheduledJobs.push(cron.schedule(schedule.expression, () => {
      try {
        void (schedule.type === "INFOS"
          ? startInfos({}, "AUTOMATIC") : startVideos({}, "AUTOMATIC"))
          .catch(error => {
            if (!(error instanceof GlobalParserBusyError) && !(error instanceof ActiveRunError))
              logger.error({ error }, "Automatic parser start failed");
          });
      } catch (error) {
        if (!(error instanceof ActiveRunError))
          logger.error({ error }, "Automatic parser start failed");
      }
    }, { timezone: "Etc/UTC" }));
    logger.info({ parser: schedule.type }, "Automatic parser schedule configured");
  }



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

      if (request.method === "GET" && url.pathname === "/hashtag-stats/status") {
        writeJson(response, 200, { running: rebuildingStats, ...lastStatsResult });
        return;
      }

      if (request.method === "POST" && url.pathname === "/hashtag-stats/rebuild") {
        const raw = await readJson(request);
        const parsed = z.object({
          hashtagId: z.string().uuid().optional(),
          hours: z.number().int().min(1).max(24 * 60).optional(),
        }).strict().safeParse(raw);
        if (!parsed.success) {
          writeApiError(response, 400, "INVALID_REBUILD", "Invalid hashtag statistics rebuild request.");
          return;
        }
        if (rebuildingStats) {
          writeApiError(response, 409, "REBUILD_ACTIVE", "Hashtag rebuild already in progress.");
          return;
        }
        const options: RebuildOptions = {
          ...(parsed.data.hashtagId ? { hashtagId: parsed.data.hashtagId } : {}),
          ...(parsed.data.hours
            ? { from: new Date(Date.now() - parsed.data.hours * 3_600_000) }
            : {}),
        };
        void runStatsRebuild(options);
        writeJson(response, 202, { accepted: true });
        return;
      }

      // Internal parser-only API. Next.js never calls Open-Meteo itself.
      // SCRUM-72 will expose these actions to authorized administrators.
      if (request.method === "POST" && url.pathname === "/weather-runs") {
        const body=await readJson(request);
        const parsed=weatherFiltersSchema.safeParse(body);
        if(!parsed.success){
          writeApiError(response,400,"INVALID_WEATHER_FILTER","Continent météo invalide.");
          return;
        }
        try{
          const runId=await startWeather(parsed.data,
            request.headers["x-parser-trigger"]==="AUTOMATIC"?"AUTOMATIC":"MANUAL");
          writeJson(response,202,{accepted:true,runId});
        }catch(e){
          if(e instanceof WeatherRunActiveError || e instanceof GlobalParserBusyError){
            writeApiError(response,409,"WEATHER_RUN_ACTIVE",e.message);return;
          }
          throw e;
        }
        return;
      }

      if(request.method==="GET"&&url.pathname==="/weather-runs"){
        writeJson(response,200,{items:await weatherEngine.latest()});
        return;
      }
      const weatherRunMatch=url.pathname.match(new RegExp("^/weather-runs/([a-f0-9-]{36})$","i"));
      if(request.method==="GET"&&weatherRunMatch?.[1]){
        const run=await weatherEngine.get(weatherRunMatch[1]);
        if(!run){writeApiError(response,404,"WEATHER_RUN_NOT_FOUND","Exécution météo introuvable.");return;}
        writeJson(response,200,run);
        return;
      }

      if (request.method === "POST" && url.pathname === "/video-runs") {
        const body = await readJson(request);
        const parsedVideo = filtersSchema.extend({ feedId: z.string().uuid().optional() }).strict().safeParse(body);
        if (!parsedVideo.success) {
          writeApiError(response, 400, "INVALID_VIDEO_FILTER", "Critères du parser vidéo invalides.");
          return;
        }
        try {
          const runId = await startVideos(parsedVideo.data,
            request.headers["x-parser-trigger"] === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL");
          writeJson(response, 202, { accepted: true, runId });
        } catch (error) {
          if (error instanceof ActiveRunError || error instanceof GlobalParserBusyError) {
            writeApiError(response, 409, "VIDEO_RUN_ACTIVE", "Une extraction vidéo est déjà en cours.");
            return;
          }
          throw error;
        }
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
          const runId = await startInfos(parsed.data,
            request.headers["x-parser-trigger"] === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL");

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
        /^\/(runs|video-runs)\/([0-9a-f-]+)\/events$/,
      );

      if (request.method === "GET" && eventMatch?.[2]) {
        const runId = eventMatch[2];
        const manager = eventMatch[1] === "video-runs" ? videoRuns : runs;

        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });

        const subscription = manager.subscribe(runId, (event) => {
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

    if (schedulerTimer) clearInterval(schedulerTimer);
    hourlyStatsJob.stop();
    fullStatsJob.stop();
    for (const job of scheduledJobs) job.stop();
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
