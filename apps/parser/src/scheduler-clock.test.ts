import { describe, expect, it } from "vitest";
import { nextScheduledAt } from "./scheduler-clock.js";

describe("scheduler clock", () => {
  it("aligns the hourly news parser", () => {
    expect(nextScheduledAt({
      parserType: "INFOS", intervalMinutes: 60, localTime: null,
      timezone: "Europe/Paris",
    }, new Date("2026-10-17T12:37:00Z")).toISOString())
      .toBe("2026-10-17T13:00:00.000Z");
  });
  it("does not duplicate a boundary", () => {
    expect(nextScheduledAt({
      parserType: "WEATHER", intervalMinutes: 240, localTime: null,
      timezone: "Europe/Paris",
    }, new Date("2026-10-17T12:00:00Z")).toISOString())
      .toBe("2026-10-17T16:00:00.000Z");
  });
  it("follows the Paris DST change in spring", () => {
    const config = { parserType: "HOROSCOPE_IMPORT" as const,
      intervalMinutes: null, localTime: "06:15", timezone: "Europe/Paris" };
    expect(nextScheduledAt(config, new Date("2026-03-28T07:00:00Z")).toISOString())
      .toBe("2026-03-29T04:15:00.000Z");
  });
  it("follows the Paris DST change in autumn", () => {
    const config = { parserType: "HOROSCOPE_IMPORT" as const,
      intervalMinutes: null, localTime: "06:15", timezone: "Europe/Paris" };
    expect(nextScheduledAt(config, new Date("2026-10-24T07:00:00Z")).toISOString())
      .toBe("2026-10-25T05:15:00.000Z");
  });
  it("rejects horoscope before 06:00", () => {
    expect(() => nextScheduledAt({
      parserType: "HOROSCOPE_IMPORT", intervalMinutes: null,
      localTime: "05:59", timezone: "Europe/Paris",
    }, new Date("2026-10-17T00:00:00Z"))).toThrow();
  });
});
