import { describe, expect, it, vi } from "vitest";
import { existingParserAdapters } from "./existing-parser-adapters.js";

describe("the three collection engine adapters used by the scheduler", () => {
  it("returns actual news/video error outcomes and preserves video provenance", async () => {
    const infos = { subscribe: vi.fn(() => ({
      events: [{ type: "run-error" }], done: true, unsubscribe: vi.fn(),
    })) };
    const videos = { subscribe: vi.fn(() => ({
      events: [{ type: "feed-success" }], done: true, unsubscribe: vi.fn(),
    })) };
    const weather = { get: vi.fn(async () => ({ status: "PARTIAL" })) };
    const launch = {
      infos: vi.fn(async () => "infos-id"),
      videos: vi.fn(async () => "video-id"),
      weather: vi.fn(async () => "weather-id"),
    };
    const adapters = existingParserAdapters(infos as never, videos as never, weather as never, launch);
    await expect(adapters.INFOS()).resolves.toEqual({ parserType: "INFOS", runId: "infos-id", status: "ERROR" });
    await expect(adapters.VIDEOS()).resolves.toEqual({ parserType: "VIDEOS", runId: "video-id", status: "SUCCESS" });
    await expect(adapters.WEATHER()).resolves.toEqual({ parserType: "WEATHER", runId: "weather-id", status: "PARTIAL" });
    expect(launch.infos).toHaveBeenCalledOnce();
    expect(launch.videos).toHaveBeenCalledOnce();
    expect(launch.weather).toHaveBeenCalledOnce();
  });

  it("fails closed rather than claiming success when a run disappears", async () => {
    const mgr = { subscribe: vi.fn(() => null) };
    const adapters = existingParserAdapters(mgr as never, mgr as never,
      { get: vi.fn(async () => null) } as never,
      { infos: async () => "gone", videos: async () => "gone", weather: async () => "gone" });
    await expect(adapters.INFOS()).rejects.toThrow();
    await expect(adapters.VIDEOS()).rejects.toThrow();
    await expect(adapters.WEATHER()).rejects.toThrow();
  });
});
