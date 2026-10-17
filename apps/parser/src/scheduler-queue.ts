import type { DatabaseClient } from "@lmn24/database";
import { nextScheduledAt, type Schedule } from "./scheduler-clock.js";

/**
 * Durable planning only. Does not start or claim parser execution.
 * The dispatcher is intentionally gated until SCRUM-85 protects ALL manual
 * and automatic entry points using a shared lock for the entire run.
 */
export async function reconcileSchedulerQueue(
  database: DatabaseClient,
  now: Date = new Date(),
): Promise<number> {
  let created = 0;
  const configurations = await database.schedulerConfig.findMany({
    where: { isEnabled: true },
  });
  for (const config of configurations) {
    await database.$transaction(async tx => {
      // Lock the configuration row: concurrent scheduler processes cannot
      // independently advance the same cursor.
      await tx.$queryRaw`SELECT parser_type FROM scheduler_config
        WHERE parser_type = ${config.parserType} FOR UPDATE`;
      const latest = await tx.schedulerConfig.findUnique({
        where: { parserType: config.parserType },
      });
      if (!latest?.isEnabled) return;
      const schedule: Schedule = {
        parserType: latest.parserType as Schedule["parserType"],
        intervalMinutes: latest.intervalMinutes,
        localTime: latest.localTime,
        timezone: latest.timezone,
      };
      const due = latest.nextDueAt ?? nextScheduledAt(schedule, now);
      if (due.getTime() > now.getTime()) {
        if (!latest.nextDueAt) {
          await tx.schedulerConfig.update({
            where: { parserType: latest.parserType },
            data: { nextDueAt: due },
          });
        }
        return;
      }
      // Catch-up is coalesced: insert a single pending occurrence, not all
      // missed ticks. Do not overwrite a still-pending job for this type.
      const outstanding = await tx.schedulerJob.count({
        where: { parserType: latest.parserType, status: { in: ["PENDING", "RUNNING"] } },
      });
      if (outstanding === 0) {
        await tx.schedulerJob.create({
          data: { parserType: latest.parserType, scheduledFor: due },
        });
        created++;
      }
      await tx.schedulerConfig.update({
        where: { parserType: latest.parserType },
        data: {
          lastScheduledAt: due,
          nextDueAt: nextScheduledAt(schedule, now),
        },
      });
    }, { maxWait: 10_000, timeout: 15_000 });
  }
  return created;
}
