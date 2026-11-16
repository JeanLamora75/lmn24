import { z } from "zod";
import { visitorCitySchema, type VisitorCity } from "@/lib/visitor-preferences";
import type { WeatherCity } from "./weather-data";

/** UI mapping: do not guess an admin city from its name alone. */
export function findCatalogFavorite(items: WeatherCity[], favorite: VisitorCity): WeatherCity | null {
  const canonical = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const matches = items.filter(item =>
    item.countryIso2 === favorite.countryIso2 &&
    item.continentCode === favorite.continent &&
    canonical(item.name) === canonical(favorite.name));
  // Never collapse two same-name cities belonging to the same country: identity is ambiguous.
  return matches.length === 1 ? matches[0] : null;
}

/** Cards stay catalog-ordered except for a single positively matched favorite. */
export function arrangeFavoriteCities(items: WeatherCity[], favorite: VisitorCity | null) {
  if (!favorite) return { catalog: items, matched: null };
  const match = findCatalogFavorite(items, favorite);
  if (!match) return { catalog: items, matched: null };
  return { catalog: [match, ...items.filter(item => item !== match)], matched: match };
}

export const favoriteWeatherQuery = visitorCitySchema.pick({
  provider: true, providerId: true, name: true, countryIso2: true, continent: true,
  latitude: true, longitude: true, timezone: true,
});
const upstreamCurrent = z.object({
  time: z.number().int().nonnegative(),
  temperature_2m: z.number().finite(),
  apparent_temperature: z.number().finite().nullable().optional(),
  relative_humidity_2m: z.number().finite().min(0).max(100).nullable().optional(),
  wind_speed_10m: z.number().finite().min(0).nullable().optional(),
  weather_code: z.number().int().finite(),
  is_day: z.union([z.literal(0), z.literal(1)]),
});
const upstreamSchema = z.object({
  timezone: z.string().min(1).max(128),
  current: upstreamCurrent,
});

/** Only Open-Meteo current readings, mapped to the SAME WeatherCard contract. */
export function normalizeFavoriteWeather(raw: unknown, city: z.infer<typeof favoriteWeatherQuery>, fetchedAt: string): WeatherCity {
  const parsed = upstreamSchema.parse(raw);
  const current = parsed.current;
  // Request timeformat=unixtime to retain the observation's real UTC instant.
  const observedAt = new Date(current.time * 1000).toISOString();
  return {
    slug: "favorite-" + city.providerId,
    name: city.name,
    countryIso2: city.countryIso2,
    continentCode: city.continent,
    timezone: parsed.timezone,
    displayOrder: -1,
    freshness: "FRESH",
    current: {
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature ?? null,
      humidityPct: current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      observedAt,
      fetchedAt,
      provider: "OPEN_METEO",
    },
  };
}

export const favoriteWeatherInput = favoriteWeatherQuery.extend({
  region: z.string().max(200).nullable().optional(),
}).strict();
