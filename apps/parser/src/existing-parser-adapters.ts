import type { DatabaseClient } from "@lmn24/database";
import { ActiveRunError, type RunManager } from "./run-manager.js";
import type { ParserFilters } from "./parser-engine.js";
import type { VideoParserFilters } from "./video-parser-engine.js";
import type { WeatherParserEngine } from "./weather-parser-engine.js";

/**
 * SCRUM-87: adapter to the ALREADY EXISTING manual parsers.
 * This module contains no timer and never starts automatically.
 *
 * IMPORTANT: the orchestrator must acquire the cross-parser, process-wide
 * execution lock before invoking an adapter; local RunManager locks do not
 * provide this guarantee. Do not deploy scheduling until SCRUM-84/85 is done.
 */
export type ExistingParserType = "INFOS" | "VIDEOS" | "WEATHER";
export type ExistingParserResult = {
  parserType: ExistingParserType;
  runId: string;
  status: "SUCCESS" | "ERROR" | "PARTIAL" | "INTERRUPTED";
};
export type ExistingParserAdapter = () => Promise<ExistingParserResult>;

type FeedRunManager = Pick<RunManager<ParserFilters>, "start" | "subscribe">;
type VideoRunManager = Pick<RunManager<VideoParserFilters>, "start" | "subscribe">;

const CHECK_MS = 1_000;

/**
 * Subscribe immediately after start. Runs are remembered for 20 completed
 * executions in RunManager; if the subscription disappears, fail closed.
 * This wait does NOT impose a timeout: force releasing a global lock while
 * a parser still works would break mutual exclusion.
 */
async function awaitFeedRun(
  manager: FeedRunManager | VideoRunManager,
  runId: string,
): Promise<"SUCCESS" | "ERROR"> {
  let sawError = false;
  while (true) {
    const subscription = manager.subscribe(runId, event => {
      if (event.type === "run-error") sawError = true;
    });
    if (!subscription) throw new ActiveRunError();
    for (const event of subscription.events) {
      if (event.type === "run-error") sawError = true;
    }
    const done = subscription.done;
    subscription.unsubscribe();
    if (done) return sawError ? "ERROR" : "SUCCESS";
    await new Promise<void>(resolve => setTimeout(resolve, CHECK_MS));
  }
}

async function awaitWeatherRun(
  engine: Pick<WeatherParserEngine, "get">,
  runId: string,
): Promise<ExistingParserResult["status"]> {
  while (true) {
    const run = await engine.get(runId);
    if (!run) throw new Error("Exécution météo introuvable : " + runId);
    if (run.status !== "RUNNING") {
      if (run.status === "SUCCESS" || run.status === "PARTIAL" ||
          run.status === "ERROR" || run.status === "INTERRUPTED") return run.status;
      throw new Error("Statut météo inconnu.");
    }
    await new Promise<void>(resolve => setTimeout(resolve, CHECK_MS));
  }
}

export function existingParserAdapters(
  _database: DatabaseClient,
  infos: FeedRunManager,
  videos: VideoRunManager,
  weather: Pick<WeatherParserEngine, "start" | "get">,
): Record<ExistingParserType, ExistingParserAdapter> {
  return {
    INFOS: async () => {
      const runId = infos.start({}, "AUTOMATIC");
      return { parserType: "INFOS", runId, status: await awaitFeedRun(infos, runId) };
    },
    VIDEOS: async () => {
      const runId = videos.start({}, "AUTOMATIC");
      return { parserType: "VIDEOS", runId, status: await awaitFeedRun(videos, runId) };
    },
    WEATHER: async () => {
      const runId = await weather.start({}, "AUTOMATIC");
      return { parserType: "WEATHER", runId, status: await awaitWeatherRun(weather, runId) };
    },
  };
}
