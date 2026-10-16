import { isWeatherRegion } from "./weather-data";
import type { WeatherRegion } from "./weather-copy";

/**
 * Site-specific cookie; scoped to / so a language switch keeps the choice.
 * Only a continent code is persisted. Never store visitor IPs or coordinates.
 */
export const WEATHER_CONTINENT_COOKIE = "lmn24_weather_continent";
export const WEATHER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
export type WeatherSelection = {
  continent: WeatherRegion;
  mode: "automatic" | "manual";
  source: "preference" | "geoip" | "fallback";
};

/**
 * Cloudflare sets CF-IPContinent at a protected edge.
 * Only trust it when the operator has EXPLICITLY opted into Cloudflare mode,
 * AND the backend origin is restricted to trusted Cloudflare traffic.
 * Other values (XX, AN, T1, malformed headers) safely fall back to Europe.
 */
export function resolveWeatherSelection({
  preference,
  cloudflareContinent,
  geoipProvider,
}: {
  preference: string | null | undefined;
  cloudflareContinent: string | null | undefined;
  geoipProvider: string | null | undefined;
}): WeatherSelection {
  if (preference && isWeatherRegion(preference)) {
    return { continent: preference, mode: "manual", source: "preference" };
  }
  if (geoipProvider === "cloudflare" &&
      cloudflareContinent && isWeatherRegion(cloudflareContinent)) {
    return { continent: cloudflareContinent, mode: "automatic", source: "geoip" };
  }
  return { continent: "EU", mode: "automatic", source: "fallback" };
}
