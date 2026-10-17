import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lmn24/database";
import { randomUUID } from "node:crypto";
import { dispatchOneSchedulerJob, type SchedulerExecutors } from "./scheduler-dispatcher.js";
import { acquireGuardedParserLease } from "./guarded-parser-lease.js";
import { GlobalParserBusyError } from "./global-parser-lock.js";

const enabled = process.env.SCHEDULER_PG_INTEGRATION === "1" && !!process.env.DATABASE_URL;
const types = ["HOROSCOPE_IMPORT", "INFOS", "VIDEOS", "WEATHER"] as const;
const db = enabled ? createPrismaClient() : undefined;
const ids: string[] = [];
const observed: string[] = [];

afterEach(async () => {
  if (!db) return;
  await db.schedulerJob.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
  await db.schedulerConfig.updateMany({ where: { parserType: { in: [...types] } }, data: { isEnabled: false } });
  observed.length = 0;
});

async function insertJobs() {
  if (!db) throw new Error("Database required");
  await db.schedulerConfig.updateMany({ where: { parserType: { in: [...types] } }, data: { isEnabled: true } });
  for (const [index, type] of types.entries()) {
    const id = randomUUID();
    ids.push(id);
    await db.schedulerJob.create({ data: {
      id, parserType: type,
      scheduledFor: new Date(Date.UTC(2040, 0, 1, 0, index)),
      notBefore: new Date("2020-01-01T00:00:00Z"),
    } });
  }
}
function executors(): SchedulerExecutors {
  const wrapped = (type: string) => async () => {
    const lease = await acquireGuardedParserLease();
    try {
      observed.push(type);
      return { status: "SUCCESS" as const };
    } finally { await lease.release(); }
  };
  return {
    INFOS: wrapped("INFOS"),
    VIDEOS: wrapped("VIDEOS"),
    WEATHER: wrapped("WEATHER"),
    HOROSCOPE_IMPORT: wrapped("HOROSCOPE_IMPORT"),
  };
}

describe.skipIf(!enabled)("isolated PostgreSQL four-parser scheduler acceptance", () => {
  it("dispatches all four enabled parsers exactly once in priority order and leaves no RUNNING jobs", async () => {
    if (!db) throw new Error("Database required");
    await insertJobs();
    const run = executors();
    for (const type of types) {
      expect(await dispatchOneSchedulerJob(db, run)).toBe("PROCESSED");
      const job = await db.schedulerJob.findUniqueOrThrow({ where: { id: ids[types.indexOf(type)]! } });
      expect(job.status).toBe("SUCCESS");
      expect(job.attempt).toBe(1);
      expect(job.ownerToken).toBeNull();
    }
    expect(observed).toEqual([...types]);
    expect(await db.schedulerJob.count({ where: { id: { in: ids }, status: "RUNNING" } })).toBe(0);
    expect(await dispatchOneSchedulerJob(db, run)).toBe("EMPTY");
  }, 50_000);

  it("does not run automatic execution while the manual parser owns the global lock", async () => {
    if (!db) throw new Error("Database required");
    await insertJobs();
    const manualLease = await acquireGuardedParserLease();
    try {
      expect(await dispatchOneSchedulerJob(db, executors())).toBe("BUSY");
      expect(observed).toHaveLength(0);
      const first = await db.schedulerJob.findUniqueOrThrow({ where: { id: ids[0]! } });
      expect(first.status).toBe("PENDING");
      expect(first.attempt).toBe(0);
      expect(first.lastError).toContain("busy");
    } finally { await manualLease.release(); }
  }, 50_000);

  it("retries a failed parser without scheduling another type and respects bounded retry", async () => {
    if (!db) throw new Error("Database required");
    await insertJobs();
    const run = executors();
    const fail = async () => {
      const lease = await acquireGuardedParserLease();
      try { return { status: "ERROR" as const }; }
      finally { await lease.release(); }
    };
    run.HOROSCOPE_IMPORT = fail;
    expect(await dispatchOneSchedulerJob(db, run)).toBe("PROCESSED");
    const id=ids[0]!;
    const first=await db.schedulerJob.findUniqueOrThrow({where:{id}});
    expect(first.status).toBe("PENDING");
    expect(first.attempt).toBe(1);
    expect(first.lastError).toContain("ERROR");
    await db.schedulerJob.update({where:{id},data:{notBefore:new Date("2020-01-01T00:00:00Z"),attempt:2}});
    expect(await dispatchOneSchedulerJob(db, run)).toBe("PROCESSED");
    const final=await db.schedulerJob.findUniqueOrThrow({where:{id}});
    expect(final.status).toBe("ERROR");
    expect(final.attempt).toBe(3);
    expect(observed).toHaveLength(0);
  }, 35_000);

  it("never dispatches any pending work while all four configurations are disabled", async () => {
    if (!db) throw new Error("Database required");
    await insertJobs();
    await db.schedulerConfig.updateMany({
      where: { parserType: { in: [...types] } },
      data: { isEnabled: false },
    });
    expect(await dispatchOneSchedulerJob(db, executors())).toBe("EMPTY");
    expect(observed).toHaveLength(0);
    expect(await db.schedulerJob.count({
      where: { id: { in: ids }, status: "PENDING", attempt: 0 },
    })).toBe(4);
  }, 30_000);

  it("returns a busy lease conflict instead of starting a second parser", async () => {
    const lease = await acquireGuardedParserLease();
    try {
      await expect(acquireGuardedParserLease()).rejects.toBeInstanceOf(GlobalParserBusyError);
    } finally { await lease.release(); }
  }, 20_000);
});

afterAll(async () => { await db?.$disconnect(); });
