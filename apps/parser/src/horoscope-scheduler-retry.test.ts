import { describe, expect, it } from "vitest";
import { nextHoroscopeMissingRetry } from "./scheduler-dispatcher.js";

describe("missing horoscope JSON retry window", () => {
  it("retries after 30 minutes within the Paris cutoff", () => {
    expect(nextHoroscopeMissingRetry(new Date("2026-10-17T05:15:00Z"),"12:00")?.toISOString())
      .toBe("2026-10-17T05:45:00.000Z");
  });
  it("stops after the Paris cutoff", () => {
    expect(nextHoroscopeMissingRetry(new Date("2026-10-17T09:45:00Z"),"12:00")).toBeNull();
  });
  it("does not schedule retries on the following civil day", () => {
    expect(nextHoroscopeMissingRetry(new Date("2026-10-17T21:45:00Z"),"23:59")).toBeNull();
  });
  it("handles Paris summer-time offsets", () => {
    expect(nextHoroscopeMissingRetry(new Date("2026-07-12T06:00:00Z"),"10:00")?.toISOString())
      .toBe("2026-07-12T06:30:00.000Z");
  });
});
