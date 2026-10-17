import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@lmn24/database";

/**
 * SQL-backed ownership fencing. All mutations compare the current owner token;
 * stale workers can neither heartbeat nor finish a job after reassignment.
 * This does not replace the separate global parser lock.
 */
export async function claimSchedulerJob(
  db: DatabaseClient,
  jobId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const token = randomUUID();
  const changed = await db.schedulerJob.updateMany({
    where: {
      id: jobId, status: "PENDING", notBefore: { lte: now },
      config: { isEnabled: true },
    },
    data: {
      status: "RUNNING", ownerToken: token, heartbeatAt: now,
      startedAt: now, finishedAt: null, attempt: { increment: 1 },
    },
  });
  return changed.count === 1 ? token : null;
}

export async function heartbeatSchedulerJob(
  db: DatabaseClient,
  jobId: string,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const changed = await db.schedulerJob.updateMany({
    where: { id: jobId, status: "RUNNING", ownerToken: token },
    data: { heartbeatAt: now },
  });
  return changed.count === 1;
}

export async function finishSchedulerJob(
  db: DatabaseClient,
  jobId: string,
  token: string,
  status: "SUCCESS" | "ERROR" | "INTERRUPTED",
  error: string | null = null,
  now: Date = new Date(),
): Promise<boolean> {
  const changed = await db.schedulerJob.updateMany({
    where: { id: jobId, status: "RUNNING", ownerToken: token },
    data: {
      status, finishedAt: now, heartbeatAt: now,
      lastError: error,
      ownerToken: null,
    },
  });
  return changed.count === 1;
}

export async function retrySchedulerJob(
  db: DatabaseClient,
  jobId: string,
  token: string,
  notBefore: Date,
  error: string,
  countAttempt = true,
): Promise<boolean> {
  const changed = await db.schedulerJob.updateMany({
    where: { id: jobId, status: "RUNNING", ownerToken: token },
    data: {
      status: "PENDING", ownerToken: null, heartbeatAt: null,
      startedAt: null, finishedAt: null, notBefore,
      lastError: error.slice(0, 1_000),
      ...(countAttempt ? {} : { attempt: { decrement: 1 } }),
    },
  });
  return changed.count === 1;
}
