import { describe, expect, it } from "vitest";
import { Client } from "pg";
import {
  acquireGlobalParserLease,
  GlobalParserBusyError,
} from "./global-parser-lock.js";

/**
 * Requires a real PostgreSQL connection and is intentionally opt-in.
 * DATABASE_URL should target an isolated TEST database.
 */
const url = process.env.SCHEDULER_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL global parser advisory lock", () => {
  it("excludes a concurrent session and releases on completion", async () => {
    const lease = await acquireGlobalParserLease(url!);
    try {
      await expect(acquireGlobalParserLease(url!))
        .rejects.toBeInstanceOf(GlobalParserBusyError);
      expect(lease.signal.aborted).toBe(false);
    } finally {
      await lease.release();
    }
    const next = await acquireGlobalParserLease(url!);
    await next.release();
  });

  it("releases a disconnected client session", async () => {
    const client = new Client({ connectionString: url! });
    await client.connect();
    try {
      const first = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock($1, $2) AS acquired", [241024, 85],
      );
      expect(first.rows[0]?.acquired).toBe(true);
      await expect(acquireGlobalParserLease(url!))
        .rejects.toBeInstanceOf(GlobalParserBusyError);
    } finally {
      await client.end();
    }
    const lease = await acquireGlobalParserLease(url!);
    await lease.release();
  });
});
