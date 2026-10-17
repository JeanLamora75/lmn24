import type { DatabaseClient } from "@lmn24/database";
import { acquireGlobalParserLease, GlobalParserBusyError } from "./global-parser-lock.js";

/**
 * Recovery is safe only while no parser is executing. It is intentionally
 * separate from the web request path and must not run on a public page hit.
 *
 * Returns null when another process currently holds the global lock.
 * Retry policy: interrupted RUNNING jobs are returned to PENDING once, up to
 * three attempts, otherwise marked INTERRUPTED.
 */
export async function recoverOrphanedSchedulerJobs(
  database: DatabaseClient,
  connectionString: string,
): Promise<number | null> {
  let lease;
  try {
    lease = await acquireGlobalParserLease(connectionString);
  } catch (error) {
    if (error instanceof GlobalParserBusyError) return null;
    throw error;
  }
  try {
    const orphaned = await database.schedulerJob.findMany({
      where: { status: "RUNNING" }, select: { id: true, attempt: true },
    });
    let recovered = 0;
    for (const job of orphaned) {
      const retry = job.attempt < 3;
      const updated = await database.schedulerJob.updateMany({
        where: { id: job.id, status: "RUNNING" },
        data: {
          status: retry ? "PENDING" : "INTERRUPTED",
          startedAt: retry ? null : undefined,
          finishedAt: retry ? null : new Date(),
          notBefore: new Date(Date.now() + 60_000),
          lastError: "Redémarrage détecté : exécution précédente interrompue.",
        },
      });
      recovered += updated.count;
    }
    return recovered;
  } finally {
    await lease.release();
  }
}
