import { describe, expect, it } from "vitest";
import { continentForLocation, geocodingQuerySchema, normalizeGeocodingResponse } from "./visitor-geocoding";

const city = (id: number, name: string, country_code: string, latitude: number, longitude: number, admin1?: string) =>
  ({ id, name, country_code, latitude, longitude, admin1, timezone: "Europe/Paris" });

describe("SCRUM-107 — global geocoding result validation", () => {
  it("maps cities in six weather continents", () => {
    const examples: Array<[string, number, number, string]> = [
      ["FR", 48, 2, "EU"], ["JP", 35, 139, "AS"], ["ZA", -26, 28, "AF"],
      ["US", 40, -73, "NA"], ["BR", -23, -46, "SA"], ["AU", -34, 151, "OC"],
    ];
    for (const [country, lat, lon, expected] of examples)
      expect(continentForLocation(country, lat, lon)).toBe(expected);
  });

  it("distinguishes important transcontinental locations and rejects unknowns", () => {
    expect(continentForLocation("RU", 55.75, 37.6)).toBe("EU");
    expect(continentForLocation("RU", 43.1, 131.8)).toBe("AS");
    expect(continentForLocation("TR", 41.1, 28.8)).toBe("EU");
    expect(continentForLocation("TR", 39.9, 32.8)).toBe("AS");
    expect(continentForLocation("AQ", -75, 0)).toBeNull();
    expect(continentForLocation("FR", 999, 0)).toBeNull();
  });

  it("keeps homonyms distinct by provider ID and geographic region", () => {
    const data = { results: [
      city(1, "Paris", "FR", 48.8566, 2.35, "Île-de-France"),
      city(2, "Paris", "FR", 45.1, 3.8, "Auvergne-Rhône-Alpes"),
      city(1, "Paris", "FR", 48.8566, 2.35, "Île-de-France"),
      city(3, "Paris", "US", 33.6, -95.6, "Texas"),
    ] };
    const results = normalizeGeocodingResponse(data, "FR");
    expect(results).toHaveLength(2);
    expect(results.map((value) => value.providerId)).toEqual(["1", "2"]);
    expect(results[0].region).toBe("Île-de-France");
    expect(results[0].continent).toBe("EU");
    expect(results.every((value) => value.countryIso2 === "FR")).toBe(true);
    expect(JSON.stringify(results)).not.toContain("birthDate");
  });

  it("handles empty and malicious upstream data without throwing", () => {
    expect(normalizeGeocodingResponse({ results: [] }, "FR")).toEqual([]);
    expect(normalizeGeocodingResponse({}, "FR")).toEqual([]);
    expect(normalizeGeocodingResponse({ results: "not-an-array" }, "FR")).toEqual([]);
    expect(normalizeGeocodingResponse({ results: [city(1, "Paris", "FR", 999, 2)] }, "FR")).toEqual([]);
  });

  it("requires a locale, valid country and minimum search length", () => {
    expect(geocodingQuerySchema.safeParse({ country: "FR", name: "Lyon", locale: "fr" }).success).toBe(true);
    for (const request of [
      { country: "fr", name: "Lyon", locale: "fr" },
      { country: "FR", name: "A", locale: "fr" },
      { country: "FR", name: "Lyon", locale: "unknown" },
      { country: "FR", name: "x".repeat(81), locale: "fr" },
    ]) expect(geocodingQuerySchema.safeParse(request).success).toBe(false);
  });
});
