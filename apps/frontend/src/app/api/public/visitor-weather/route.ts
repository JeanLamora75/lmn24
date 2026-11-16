import { NextResponse } from "next/server";
import { favoriteWeatherInput, normalizeFavoriteWeather } from "@/components/weather/favorite-weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 900;
const GOOD_CACHE = "private, no-store";
const UPSTREAM = "https://api.open-meteo.com/v1/forecast";

/**
 * Visitor favorite observations; coordinates and city identity are sent in
 * a POST body, not in a public URL or any server-side persistence.
 * No database, cookie, profile or date of birth is accessed.
 */
export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid-city" }, { status: 413 });
  }
  let data: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return NextResponse.json({ error: "invalid-city" }, { status: 413 });
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid-city" }, { status: 400 });
  }
  const parsed = favoriteWeatherInput.safeParse(data);
  if (!parsed.success || parsed.data.provider !== "open-meteo-geocoding") {
    return NextResponse.json({ error: "invalid-city" }, { status: 400 });
  }
  const city = parsed.data;
  const apiUrl = new URL(UPSTREAM);
  apiUrl.searchParams.set("latitude", String(city.latitude));
  apiUrl.searchParams.set("longitude", String(city.longitude));
  apiUrl.searchParams.set("current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day");
  apiUrl.searchParams.set("timezone", "auto");
  try {
    const response = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(6500),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 429) {
      return NextResponse.json({ error: "rate-limited" }, { status: 429, headers: { "cache-control": GOOD_CACHE } });
    }
    if (!response.ok) throw new Error("weather-upstream-unavailable");
    const fetchedAt = new Date().toISOString();
    const cityWeather = normalizeFavoriteWeather(await response.json(), city, fetchedAt);
    return NextResponse.json({ city: cityWeather }, {
      headers: { "cache-control": GOOD_CACHE, "x-content-type-options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "weather-unavailable" }, { status: 503, headers: { "cache-control": GOOD_CACHE } });
  }
}
