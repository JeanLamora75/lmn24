import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const request = (country: string, name: string, locale = "fr") =>
  new NextRequest("http://localhost:3000/api/public/visitor-cities?" +
    new URLSearchParams({ country, name, locale }).toString());

afterEach(() => vi.unstubAllGlobals());

describe("SCRUM-107 — anonymous geocoding proxy", () => {
  it("rejects invalid country/query before any upstream request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await GET(request("FR", "A"))).status).toBe(400);
    expect((await GET(request("ZZ", "Paris"))).status).toBe(400);
    expect((await GET(request("fr", "Paris"))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("filters by country, validates response and exposes only city fields", async () => {
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      results: [
        { id: 2988507, name: "Paris", country_code: "FR",
          latitude: 48.8566, longitude: 2.3522, admin1: "Île-de-France",
          timezone: "Europe/Paris", population: 2200000 },
        { id: 4717560, name: "Paris", country_code: "US",
          latitude: 33.66, longitude: -95.55, admin1: "Texas" },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const response = await GET(request("FR", "Paris"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.cities).toHaveLength(1);
    expect(payload.cities[0]).toMatchObject({
      provider: "open-meteo-geocoding", providerId: "2988507",
      countryIso2: "FR", continent: "EU", name: "Paris",
    });
    expect(JSON.stringify(payload)).not.toContain("population");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const upstreamUrl = new URL(upstream.mock.calls[0]?.[0] ?? "");
    expect(upstreamUrl.hostname).toBe("geocoding-api.open-meteo.com");
    expect(upstreamUrl.searchParams.get("countryCode")).toBe("FR");
    expect(upstreamUrl.searchParams.get("name")).toBe("Paris");
    expect(upstreamUrl.searchParams.has("birthDate")).toBe(false);
  });

  it("preserves upstream rate limits and handles timeouts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    expect((await GET(request("FR", "Paris"))).status).toBe(429);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    expect((await GET(request("FR", "Paris"))).status).toBe(503);
  });
});
