import { describe, expect, it, vi } from "vitest";
import { PersistentRunLog, safeLogText } from "./persistent-run-log.js";
import type { DatabaseClient } from "@lmn24/database";

function fixture() {
  const create = vi.fn().mockResolvedValue({ id: "run" });
  const update = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 2 });
  const db = {
    parserBatchRun: { create, update, updateMany },
    parserRunEvent: { create: vi.fn().mockResolvedValue({}) },
    feedRun: { findMany: vi.fn().mockResolvedValue([
      { status: "SUCCESS", itemsFound: 6, articlesImported: 4, articlesSkipped: 2 },
      { status: "ERROR", itemsFound: 0, articlesImported: 0, articlesSkipped: 0 },
    ]) },
    feedVideoRun: { findMany: vi.fn().mockResolvedValue([
      { status: "SUCCESS", itemsFound: 4, videosImported: 3, videosSkipped: 1 },
    ]) },
    $transaction: vi.fn(async (p: Promise<unknown>[]) => Promise.all(p)),
  };
  return { db, log: new PersistentRunLog(db as unknown as DatabaseClient, "INFOS") };
}
describe("SCRUM-60 — durable parser logs", () => {
  it("creates MANUAL/AUTOMATIC batches without saving arbitrary request secrets", async () => {
    const { db, log } = fixture();
    await log.start("r1", { countryIsoCode2: "FR", languageIsoCode2: "fr" }, "MANUAL");
    expect(db.parserBatchRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "r1", parserType: "INFOS", trigger: "MANUAL",
        filters: { countryIsoCode2: "FR", languageIsoCode2: "fr" },
      }),
    });
  });
  it("saves chronological sanitized events and heartbeat", async () => {
    const { db, log } = fixture();
    await log.event("r1", { type: "feed-error",
      timestamp: "2026-10-14T10:00:00Z",
      message: "Error token=SECRET authorization=abc Bearer VERYSECRET" });
    const call = db.parserRunEvent.create.mock.calls[0]?.[0];
    expect(call.data.level).toBe("ERROR");
    expect(call.data.message).not.toContain("SECRET");
    expect(call.data.message).toContain("[REDACTED]");
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(safeLogText("https://user:pass@example.org/a?api_key=ABCD"))
      .not.toContain("pass");
  });
  it("finishes a mixed Infos batch using linked feed runs", async () => {
    const { db, log } = fixture();
    await log.finish("r1", false);
    expect(db.feedRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { batchRunId: "r1" },
    }));
    expect(db.parserBatchRun.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({
        status: "ERROR", processedFeeds: 2,
        successfulFeeds: 1, failedFeeds: 1,
        itemsImported: 4, itemsSkipped: 2, itemsFound: 6,
      }),
    });
  });
  it("marks only older orphaned RUNNING batches interrupted", async () => {
    const { db, log } = fixture();
    await expect(log.recoverInterrupted()).resolves.toBe(2);
    expect(db.parserBatchRun.updateMany).toHaveBeenCalledWith({
      where: { parserType: "INFOS", status: "RUNNING",
        lastHeartbeatAt: { lt: expect.any(Date) } },
      data: { status: "INTERRUPTED", finishedAt: expect.any(Date) },
    });
  });
});
