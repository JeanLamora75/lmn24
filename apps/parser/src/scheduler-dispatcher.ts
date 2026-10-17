import type { DatabaseClient } from "@lmn24/database";
import { GlobalParserBusyError } from "./global-parser-lock.js";
import { randomUUID } from "node:crypto";
import { finishSchedulerJob, heartbeatSchedulerJob, retrySchedulerJob } from "./scheduler-job-ownership.js";

export type SchedulerParserType = "INFOS" | "VIDEOS" | "WEATHER" | "HOROSCOPE_IMPORT";
export type SchedulerOutcome = "SUCCESS" | "ERROR" | "PARTIAL" | "INTERRUPTED" | "SKIPPED";
export type SchedulerExecutor = () => Promise<{ status: SchedulerOutcome }>;
export type SchedulerExecutors = Record<SchedulerParserType, SchedulerExecutor>;

const PRIORITIES: Record<SchedulerParserType, number> = {
  HOROSCOPE_IMPORT: 0, INFOS: 1, VIDEOS: 2, WEATHER: 3,
};
const WAIT_FOR_LOCK_MS = 30_000;
const MAX_ATTEMPTS = 3;

function isParserType(value: string): value is SchedulerParserType {
  return value === "INFOS" || value === "VIDEOS" ||
    value === "WEATHER" || value === "HOROSCOPE_IMPORT";
}

/**
 * Claims exactly one job with a locked row, respecting global parser priority.
 * This function does not start anything by itself: a caller must explicitly
 * supply registered, already globally locked parser entry points.
 *
 * NOTE: keep scheduling disabled until the administrator activation gate and
 * multi-process PostgreSQL integration tests are completed.
 */
export async function dispatchOneSchedulerJob(
  database: DatabaseClient,
  executors: SchedulerExecutors,
  now: Date = new Date(),
): Promise<"EMPTY" | "BUSY" | "PROCESSED"> {
  const ownerToken = randomUUID();
  const job = await database.$transaction(async tx => {
    // SKIP LOCKED makes concurrent schedulers claim different jobs. The
    // advisory lock inside every executor guarantees only one parser runs.
    const eligible = await tx.$queryRaw<Array<{ id: string; parser_type: string }>>`
      SELECT j.id, j.parser_type
      FROM scheduler_job j
      JOIN scheduler_config c ON c.parser_type = j.parser_type
      WHERE j.status = 'PENDING' AND j.not_before <= ${now}
        AND c.is_enabled = TRUE
      ORDER BY CASE j.parser_type
        WHEN 'HOROSCOPE_IMPORT' THEN 0
        WHEN 'INFOS' THEN 1 WHEN 'VIDEOS' THEN 2
        WHEN 'WEATHER' THEN 3 ELSE 4 END,
        j.scheduled_for ASC, j.id ASC
      LIMIT 1 FOR UPDATE OF j SKIP LOCKED
    `;
    const picked = eligible[0];
    if (!picked || !isParserType(picked.parser_type)) return null;
    return tx.schedulerJob.update({
      where: { id: picked.id },
      data: { status: "RUNNING", startedAt: new Date(), heartbeatAt: new Date(), ownerToken, attempt: { increment: 1 } },
    });
  }, { maxWait: 10_000, timeout: 15_000 });
  if (!job || !isParserType(job.parserType)) return "EMPTY";

  const executor = executors[job.parserType];
  // A heartbeat prevents recovering a live reservation while it is waiting
  // for the guarded parser wrapper to begin execution.
  let heartbeatLost = false;
  const timer = setInterval(() => {
    void heartbeatSchedulerJob(database, job.id, ownerToken)
      .then(ok => { if (!ok) heartbeatLost = true; })
      .catch(() => { heartbeatLost = true; });
  }, 10_000);
  try {
    const result = await executor();
    const status = result.status;
    // PARTIAL is not a full success; it remains visible but does not trigger
    // blind retries that might overload provider APIs.
    if (heartbeatLost) throw new Error("Scheduler ownership heartbeat lost");
    const success = await finishSchedulerJob(database, job.id, ownerToken,
      status === "SUCCESS" || status === "SKIPPED" ? "SUCCESS" :
      status === "INTERRUPTED" ? "INTERRUPTED" : "ERROR",
      status === "SUCCESS" || status === "SKIPPED" ? null : "Exécution incomplète.");
    if (!success) throw new Error("Scheduler job ownership lost");
    return "PROCESSED";
  } catch (error) {
    if (error instanceof GlobalParserBusyError) {
      // Conflict with a manual parser is NOT an execution attempt.
      await retrySchedulerJob(database, job.id, ownerToken,
        new Date(Date.now() + WAIT_FOR_LOCK_MS), "Global parser lock busy", false);
      return "BUSY";
    }
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    const retry = job.attempt < MAX_ATTEMPTS;
    if (retry) {
      await retrySchedulerJob(database, job.id, ownerToken,
        new Date(Date.now() + Math.min(30 * 60_000, 60_000 * 2 ** (job.attempt - 1))),
        message);
    } else {
      await finishSchedulerJob(database, job.id, ownerToken, "ERROR", message.slice(0, 1_000));
    }
    return "PROCESSED";
  } finally { clearInterval(timer); }
}

export const SCHEDULER_PRIORITIES = PRIORITIES;
