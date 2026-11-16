import { z } from "zod";
import type { VisitorCity } from "./visitor-preferences";

/**
 * SCRUM-107 — country-to-weather-region lookup.
 * Country codes follow ISO 3166-1 alpha-2; NA includes Central America and Caribbean.
 * Unmapped/Antarctic territories are excluded, rather than inventing a continent.
 */
const CONTINENT_CODES = {
  EU: "AL AD AT AX BE BG BY BA CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK",
  AS: "AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE",
  AF: "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
  NA: "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
  SA: "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
  OC: "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
} as const;
export type WeatherContinent = keyof typeof CONTINENT_CODES;
const countryToContinent = new Map<string, WeatherContinent>();
for (const [continent, codes] of Object.entries(CONTINENT_CODES)) {
  for (const code of codes.split(" ")) countryToContinent.set(code, continent as WeatherContinent);
}

export function continentForLocation(
  countryCode: string,
  latitude: number,
  longitude: number,
): WeatherContinent | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const country = countryCode.toUpperCase();
  // The country alone is insufficient for transcontinental countries.
  if (country === "RU") return longitude < 60 ? "EU" : "AS";
  if (country === "TR") return longitude < 29.0 && latitude >= 40 ? "EU" : "AS";
  if (country === "KZ") return longitude < 51 ? "EU" : "AS";
  if (country === "AZ") return "AS";
  if (country === "GE") return "AS";
  return countryToContinent.get(country) ?? null;
}

export const geocodingQuerySchema = z.strictObject({
  country: z.string().regex(/^[A-Z]{2}$/),
  name: z.string().trim().min(2).max(80),
  locale: z.enum(["fr", "en", "de", "es", "pt", "it", "ru", "nl"]),
});

const openMeteoCitySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  admin1: z.string().trim().max(200).optional(),
  timezone: z.string().trim().max(128).optional(),
});
const openMeteoResponseSchema = z.object({
  results: z.array(openMeteoCitySchema).max(100).optional(),
});

/** Only allowlisted fields go to the browser; no date of birth, IP, or local preferences. */
export function normalizeGeocodingResponse(
  data: unknown,
  country: string,
): VisitorCity[] {
  const payload = openMeteoResponseSchema.safeParse(data);
  if (!payload.success) return [];
  const results: VisitorCity[] = [];
  const seen = new Set<string>();
  for (const value of payload.data.results ?? []) {
    if (value.country_code !== country) continue;
    const continent = continentForLocation(value.country_code, value.latitude, value.longitude);
    if (!continent) continue;
    const providerId = String(value.id);
    if (seen.has(providerId)) continue;
    seen.add(providerId);
    results.push({
      provider: "open-meteo-geocoding",
      providerId,
      name: value.name,
      region: value.admin1 || null,
      countryIso2: value.country_code,
      continent,
      latitude: value.latitude,
      longitude: value.longitude,
      timezone: value.timezone || null,
    });
  }
  return results;
}
