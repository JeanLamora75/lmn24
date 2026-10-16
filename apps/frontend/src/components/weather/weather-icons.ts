/** SCRUM-76: stable mapping of Open-Meteo WMO codes and isDay to actual local Meteocons Flat SVG assets.
 * Only constant validated asset names are returned: no URL or filename can come from user input.
 * MIT © 2020-present Bas Milius: see /weather-icons/LICENSE-METEOCONS.txt.
 */
export const WEATHER_ICON_NAMES = [
  "clear-day", "clear-night",
  "partly-cloudy-day", "partly-cloudy-night",
  "cloudy", "overcast", "fog", "drizzle", "rain", "snow", "sleet",
  "thunderstorms-day", "thunderstorms-night", "thunderstorms-extreme",
  "not-available", "partly-cloudy-day-rain", "partly-cloudy-night-rain",
  "hail",
] as const;

export type WeatherIconName = (typeof WEATHER_ICON_NAMES)[number];
export function weatherIconName(
  weatherCode: number | null | undefined,
  isDay: boolean,
): WeatherIconName {
  if (weatherCode === null || weatherCode === undefined ||
      !Number.isInteger(weatherCode)) return "not-available";
  if (weatherCode === 0) return isDay ? "clear-day" : "clear-night";
  if (weatherCode === 1 || weatherCode === 2) {
    return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  }
  if (weatherCode === 3) return "overcast";
  if (weatherCode === 45 || weatherCode === 48) return "fog";
  if (weatherCode >= 51 && weatherCode <= 55) return "drizzle";
  if (weatherCode === 56 || weatherCode === 57 ||
      weatherCode === 66 || weatherCode === 67) return "sleet";
  if (weatherCode >= 61 && weatherCode <= 65) return "rain";
  if (weatherCode >= 71 && weatherCode <= 77) return "snow";
  if (weatherCode >= 80 && weatherCode <= 82) {
    return isDay ? "partly-cloudy-day-rain" : "partly-cloudy-night-rain";
  }
  if (weatherCode === 85 || weatherCode === 86) return "snow";
  if (weatherCode === 95) {
    return isDay ? "thunderstorms-day" : "thunderstorms-night";
  }
  if (weatherCode === 96 || weatherCode === 99) return "thunderstorms-extreme";
  return "not-available";
}

export function weatherIconPath(
  weatherCode: number | null | undefined,
  isDay: boolean,
): string {
  return "/weather-icons/" + weatherIconName(weatherCode, isDay) + ".svg";
}
