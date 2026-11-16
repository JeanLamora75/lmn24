import { NextRequest, NextResponse } from "next/server";
import { geocodingQuerySchema, normalizeGeocodingResponse } from "@/lib/visitor-geocoding";
import { COUNTRY_ISO2 } from "@/lib/visitor-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://geocoding-api.open-meteo.com/v1/search";
const SUPPORTED_COUNTRIES = new Set(COUNTRY_ISO2);

/**
 * Anonymous geocoding. No database access, API key or per-visitor data persistence.
 * Proxy request contains ONLY the explicit country, search text and locale.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const candidate = {
    country: url.searchParams.get("country") ?? "",
    name: url.searchParams.get("name") ?? "",
    locale: url.searchParams.get("locale") ?? "en",
  };
  const parsed = geocodingQuerySchema.safeParse(candidate);
  if (!parsed.success || !SUPPORTED_COUNTRIES.has(candidate.country)) {
    return NextResponse.json({ error: "invalid-query" }, { status: 400 });
  }
  const { country, name, locale } = parsed.data;
  const upstreamUrl = new URL(UPSTREAM);
  upstreamUrl.searchParams.set("name", name);
  upstreamUrl.searchParams.set("count", "10");
  upstreamUrl.searchParams.set("language", locale);
  upstreamUrl.searchParams.set("format", "json");
  upstreamUrl.searchParams.set("countryCode", country);
  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (response.status === 429) {
      return NextResponse.json({ error: "rate-limited" }, { status: 429 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: "geocoding-unavailable" }, { status: 502 });
    }
    const data: unknown = await response.json();
    const cities = normalizeGeocodingResponse(data, country);
    return NextResponse.json({ cities }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "geocoding-unavailable" }, { status: 503 });
  }
}
