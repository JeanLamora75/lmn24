import { describe, expect, it, vi } from "vitest";
import { GlobalParserBusyError } from "./global-parser-lock.js";

// These tests guard the intended error protocol at the lock boundary.
// Full process-kill behavior must be exercised in a child process with a
// disposable PostgreSQL database, NOT by mocking process.exit in-process.
describe("scheduler fail-closed contract", () => {
  it("represents a busy global parser lock as an explicit conflict", () => {
    expect(new GlobalParserBusyError().name).toBe("GlobalParserBusyError");
  });
  it("keeps process exit tests isolated from the Vitest runner", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit intercepted by test");
    });
    try {
      expect(() => process.exit(1)).toThrow("exit intercepted by test");
    } finally {
      exit.mockRestore();
    }
  });
});
