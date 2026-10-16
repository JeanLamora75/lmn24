import { NextResponse } from "next/server";
import { getBackendUrl } from "../../../../lib/admin-backend";
import { isWeatherRegion, parseWeatherResponse } from "../../../../components/weather/weather-data";

/** Public weather stays isolated from admin sessions and the Open-Meteo API. */
const MAX_RESPONSE_CHARS = 128_000;
const GOOD_CACHE = "public, max-age=30, stale-while-revalidate=30";
const NO_STORE = "no-store";

export async function GET(request: Request): Promise<Response> {
  const input = new URL(request.url).searchParams;
  const continent = input.get("continent") ?? "EU";
  if (!isWeatherRegion(continent) ||
      [...input.keys()].some(key => key !== "continent") ||
      input.getAll("continent").length > 1) {
    return NextResponse.json({ message: "Invalid weather continent." }, {
      status: 400, headers: { "cache-control": NO_STORE },
    });
  }

  try {
    const response = await fetch(
      getBackendUrl() + "/weather?continent=" + encodeURIComponent(continent),
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) {
      // Do not reflect internal backend errors to public visitors.
      return NextResponse.json({ message: "Weather service unavailable." }, {
        status: 503, headers: { "cache-control": NO_STORE },
      });
    }
    const announcedSize = Number(response.headers.get("content-length"));
    if (announcedSize > MAX_RESPONSE_CHARS) throw new Error("Weather response too large.");
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARS) throw new Error("Weather response too large.");
    const raw: unknown = JSON.parse(body);
    const parsed = parseWeatherResponse(raw, continent);
    if (parsed.items.length > 150 || parsed.count !== parsed.items.length) {
      throw new Error("Invalid weather city count.");
    }
    return NextResponse.json(parsed, {
      status: 200,
      headers: {
        "cache-control": GOOD_CACHE,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "Weather service unavailable." }, {
      status: 503, headers: { "cache-control": NO_STORE },
    });
  }
}
