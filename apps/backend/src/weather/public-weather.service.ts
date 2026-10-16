import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export type WeatherContinent = "EU" | "AS" | "AF" | "NA" | "SA" | "OC";
export type WeatherFreshness = "FRESH" | "STALE" | "UNAVAILABLE";

export const DEFAULT_WEATHER_STALE_MINUTES = 180;

/** Treat invalid/unconfigured values as a safe default. Do not permit unbounded staleness. */
export function weatherStaleMinutes(value: string | null | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return DEFAULT_WEATHER_STALE_MINUTES;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 43_200
    ? parsed : DEFAULT_WEATHER_STALE_MINUTES;
}

export function weatherFreshness(
  observedAt: Date | null,
  at: Date,
  staleAfterMinutes: number,
): WeatherFreshness {
  if (!observedAt || !Number.isFinite(observedAt.getTime())) return "UNAVAILABLE";
  const age = at.getTime() - observedAt.getTime();
  // Accept the small clock skew between supplier and our server (up to 2 minutes).
  if (age < -120_000) return "STALE";
  return age > staleAfterMinutes * 60_000 ? "STALE" : "FRESH";
}

type CurrentReading = {
  temperatureC: { toString(): string };
  apparentTemperatureC: { toString(): string } | null;
  humidityPct: number | null;
  windSpeedKmh: { toString(): string } | null;
  weatherCode: number;
  isDay: boolean;
  observedAt: Date;
  fetchedAt: Date;
  provider: string;
};
type CityWithReading = {
  slug: string;
  name: string;
  countryIso2: string;
  continentCode: string;
  timezone: string;
  displayOrder: number;
  current: CurrentReading | null;
};

/** Stable public DTO: contains no admin IDs, IPs, logs or secrets. */
export function serializeWeatherCity(
  city: CityWithReading,
  at: Date,
  staleAfterMinutes: number,
) {
  const reading = city.current;
  return {
    slug: city.slug,
    name: city.name,
    countryIso2: city.countryIso2.trim(),
    continentCode: city.continentCode.trim(),
    timezone: city.timezone,
    displayOrder: city.displayOrder,
    freshness: weatherFreshness(reading?.observedAt ?? null, at, staleAfterMinutes),
    current: reading ? {
      temperatureC: Number(reading.temperatureC),
      apparentTemperatureC: reading.apparentTemperatureC === null
        ? null : Number(reading.apparentTemperatureC),
      humidityPct: reading.humidityPct,
      windSpeedKmh: reading.windSpeedKmh === null
        ? null : Number(reading.windSpeedKmh),
      weatherCode: reading.weatherCode,
      isDay: reading.isDay,
      observedAt: reading.observedAt.toISOString(),
      fetchedAt: reading.fetchedAt.toISOString(),
      provider: reading.provider,
    } : null,
  };
}

@Injectable()
export class PublicWeatherService {
  constructor(private readonly db: DatabaseService) {}

  async list(continent: WeatherContinent) {
    const at = new Date();
    const [cities, settings] = await Promise.all([
      this.db.prisma.weatherCity.findMany({
        where: { continentCode: continent, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
        select: {
          slug: true, name: true, countryIso2: true, continentCode: true,
          timezone: true, displayOrder: true,
          current: {
            select: {
              temperatureC: true, apparentTemperatureC: true, humidityPct: true,
              windSpeedKmh: true, weatherCode: true, isDay: true,
              observedAt: true, fetchedAt: true, provider: true,
            },
          },
        },
      }),
      this.db.prisma.setting.findFirst({
        where: { key: "weatherStaleAfterMinutes", scope: "GLOBAL" },
        select: { value: true },
      }),
    ]);
    const staleAfterMinutes = weatherStaleMinutes(settings?.value);
    return {
      continent,
      generatedAt: at.toISOString(),
      staleAfterMinutes,
      attribution: {
        name: "Open-Meteo",
        url: "https://open-meteo.com/",
      },
      count: cities.length,
      items: cities.map(city => serializeWeatherCity(city, at, staleAfterMinutes)),
    };
  }
}
