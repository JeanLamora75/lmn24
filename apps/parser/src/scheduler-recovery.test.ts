import { describe, expect, it, vi, beforeEach } from "vitest";
import { GlobalParserBusyError } from "./global-parser-lock.js";

const { lease, acquire } = vi.hoisted(() => {
  const lease = { release: vi.fn(async () => undefined), signal: new AbortController().signal };
  return { lease, acquire: vi.fn(async () => lease) };
});
vi.mock("./global-parser-lock.js", async importOriginal => {
  const original = await importOriginal<typeof import("./global-parser-lock.js")>();
  return { ...original, acquireGlobalParserLease: acquire };
});
import { recoverOrphanedSchedulerJobs } from "./scheduler-recovery.js";

beforeEach(() => {
  acquire.mockReset();
  acquire.mockResolvedValue(lease);
  lease.release.mockClear();
});

describe("scheduler recovery fencing", () => {
  it("does not touch jobs while an active global parser holds the lease", async () => {
    acquire.mockRejectedValueOnce(new GlobalParserBusyError());
    const findMany = vi.fn();
    const db = { schedulerJob: { findMany } } as never;
    await expect(recoverOrphanedSchedulerJobs(db, "test", new Date("2026-10-17T10:00:00Z")))
      .resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("updates stale jobs only while holding the global lease and comparing owner token", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = { schedulerJob: {
      findMany: vi.fn(async () => [{ id: "job-1", attempt: 1, ownerToken: "owner-1" }]),
      updateMany,
    } } as never;
    const cutoff = new Date("2026-10-17T10:00:00Z");
    await expect(recoverOrphanedSchedulerJobs(db, "test", cutoff)).resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "job-1", status: "RUNNING", ownerToken: "owner-1",
        heartbeatAt: { lt: cutoff },
      }),
      data: expect.objectContaining({ status: "PENDING", ownerToken: null }),
    }));
    expect(lease.release).toHaveBeenCalledOnce();
  });
  it("does not requeue a stale snapshot if the owner heartbeat changes", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const db = { schedulerJob: {
      findMany: vi.fn(async () => [{ id: "job-2", attempt: 2, ownerToken: "old-owner" }]),
      updateMany,
    } } as never;
    const cutoff = new Date("2026-10-17T10:00:00Z");
    await expect(recoverOrphanedSchedulerJobs(db, "test", cutoff)).resolves.toBe(0);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "job-2", ownerToken: "old-owner", heartbeatAt: { lt: cutoff },
      }),
    }));
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it("marks exhausted orphaned jobs INTERRUPTED instead of relaunching them", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = { schedulerJob: {
      findMany: vi.fn(async () => [{ id: "job-3", attempt: 3, ownerToken: "owner-3" }]),
      updateMany,
    } } as never;
    await expect(recoverOrphanedSchedulerJobs(db, "test", new Date("2026-10-17T10:00:00Z")))
      .resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "INTERRUPTED", ownerToken: null }),
    }));
    expect(lease.release).toHaveBeenCalledOnce();
  });

});
