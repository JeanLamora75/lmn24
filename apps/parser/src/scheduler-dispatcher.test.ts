import { describe, expect, it } from "vitest";
import { isRetryableParserOutcome } from "./scheduler-dispatcher.js";

describe("scheduler terminal outcomes and retries", () => {
  it("retries explicit parser failures and interruptions", () => {
    expect(isRetryableParserOutcome("ERROR")).toBe(true);
    expect(isRetryableParserOutcome("INTERRUPTED")).toBe(true);
  });
  it("does not retry successful, skipped or partial runs blindly", () => {
    expect(isRetryableParserOutcome("SUCCESS")).toBe(false);
    expect(isRetryableParserOutcome("SKIPPED")).toBe(false);
    expect(isRetryableParserOutcome("PARTIAL")).toBe(false);
  });
});
