import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WEATHER_STALE_MINUTES,
  PublicWeatherService, serializeWeatherCity,
  weatherFreshness, weatherStaleMinutes,
} from "./public-weather.service";

const at = new Date("2026-10-16T12:00:00.000Z");
const reading = (minutesAgo: number) => ({
  temperatureC: { toString: () => "18.50" },
  apparentTemperatureC: { toString: () => "17.25" },
  humidityPct: 66,
  windSpeedKmh: { toString: () => "12.30" },
  weatherCode: 2,
  isDay: true,
  observedAt: new Date(at.getTime() - minutesAgo * 60_000),
  fetchedAt: new Date(at.getTime() - (minutesAgo - 1) * 60_000),
  provider: "OPEN_METEO",
});
const city = (slug: string, order: number, current: ReturnType<typeof reading> | null) => ({
  slug, name: slug, countryIso2: "FR",
  continentCode: "EU", timezone: "Europe/Paris",
  displayOrder: order, current,
});

describe("SCRUM-73 — public weather freshness and DTO", () => {
  it("uses bounded configuration defaults", () => {
    expect(weatherStaleMinutes("180")).toBe(180);
    expect(weatherStaleMinutes("15")).toBe(15);
    for (const value of [null, undefined, "0", "-1", "99999999", "1.5", "invalid"]) {
      expect(weatherStaleMinutes(value)).toBe(DEFAULT_WEATHER_STALE_MINUTES);
    }
  });
  it("distinguishes new, old, future and missing readings", () => {
    expect(weatherFreshness(reading(179).observedAt, at, 180)).toBe("FRESH");
    expect(weatherFreshness(reading(180).observedAt, at, 180)).toBe("FRESH");
    expect(weatherFreshness(reading(181).observedAt, at, 180)).toBe("STALE");
    expect(weatherFreshness(null, at, 180)).toBe("UNAVAILABLE");
    expect(weatherFreshness(new Date(at.getTime() + 3 * 60_000), at, 180)).toBe("STALE");
  });
  it("serializes only safe public fields and preserves last known old observations", () => {
    const result = serializeWeatherCity(city("paris", 1, reading(181)), at, 180);
    expect(result).toEqual({
      slug: "paris", name: "paris", countryIso2: "FR",
      continentCode: "EU", timezone: "Europe/Paris", displayOrder: 1,
      freshness: "STALE",
      current: {
        temperatureC: 18.5, apparentTemperatureC: 17.25,
        humidityPct: 66, windSpeedKmh: 12.3, weatherCode: 2, isDay: true,
        observedAt: reading(181).observedAt.toISOString(),
        fetchedAt: reading(181).fetchedAt.toISOString(), provider: "OPEN_METEO",
      },
    });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("latitude");
    expect(result).not.toHaveProperty("ip");
    expect(serializeWeatherCity(city("london", 2, null), at, 180)).toMatchObject({
      freshness: "UNAVAILABLE", current: null,
    });
  });
  it("reads active cities even without observations and keeps the requested order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(at);
    const list = vi.fn(async () => [
      city("paris", 1, reading(1)),
      city("london", 2, null),
      city("berlin", 3, reading(500)),
    ]);
    const setting = vi.fn(async () => ({ value: "180" }));
    const service = new PublicWeatherService({
      prisma: { weatherCity: { findMany: list }, setting: { findFirst: setting } },
    } as never);
    const data = await service.list("EU");
    expect(data.continent).toBe("EU");
    expect(data.count).toBe(3);
    expect(data.attribution.url).toBe("https://open-meteo.com/");
    expect(data.staleAfterMinutes).toBe(180);
    expect(data.items.map(c => c.slug)).toEqual(["paris", "london", "berlin"]);
    expect(data.items.map(c => c.freshness)).toEqual(["FRESH", "UNAVAILABLE", "STALE"]);
    expect(list).toHaveBeenCalledWith({
      where: { continentCode: "EU", isActive: true },
      orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
      select: expect.objectContaining({
        current: { select: expect.objectContaining({ observedAt: true, fetchedAt: true }) },
      }),
    });
    expect(setting).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it("honors a modified freshness setting and empty continent", async () => {
    const list = vi.fn(async () => []);
    const service = new PublicWeatherService({
      prisma: {
        weatherCity: { findMany: list },
        setting: { findFirst: vi.fn(async () => ({ value: "60" })) },
      },
    } as never);
    const result = await service.list("OC");
    expect(result).toMatchObject({ continent: "OC", count: 0, items: [], staleAfterMinutes: 60 });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      where: { continentCode: "OC", isActive: true },
    }));
  });
});
