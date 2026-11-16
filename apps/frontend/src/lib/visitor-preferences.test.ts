import { describe, expect, it } from "vitest";
import {
  VISITOR_PREFERENCES_KEY,
  changeVisitorCountry,
  defaultVisitorPreferences,
  parseVisitorPreferences,
  persistVisitorPreferences,
  readVisitorPreferences,
  resetVisitorPreference,
} from "./visitor-preferences";

const paris = {
  provider: "geocoder", providerId: "2988507", name: "Paris", region: "Île-de-France",
  countryIso2: "FR", continent: "EU" as const,
  latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris",
};
const valid = { ...defaultVisitorPreferences(), theme: "dark" as const,
  countryIso2: "FR", city: paris, birthDate: "2000-02-29" };
function memoryStorage(initial: string | null = null) {
  const data = new Map<string, string>();
  if (initial !== null) data.set(VISITOR_PREFERENCES_KEY, initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    snapshot: () => data.get(VISITOR_PREFERENCES_KEY),
  };
}

describe("SCRUM-103 — versioned browser-only preferences", () => {
  it("keeps missing preferences neutral, without writing storage", () => {
    const storage = memoryStorage();
    expect(readVisitorPreferences(storage)).toEqual(defaultVisitorPreferences());
    expect(storage.snapshot()).toBeUndefined();
  });

  it("persists only a validated v1 snapshot on explicit save", () => {
    const storage = memoryStorage();
    const result = persistVisitorPreferences(storage, valid);
    expect(result).toEqual({ ok: true, value: valid });
    expect(readVisitorPreferences(storage)).toEqual(valid);
    expect(JSON.parse(storage.snapshot()!)).not.toHaveProperty("sign");
  });

  it("accepts an explicit version-zero migration and never writes during read", () => {
    const original = JSON.stringify({ ...valid, version: 0, theme: "auto", extra: "discard" });
    const storage = memoryStorage(original);
    expect(readVisitorPreferences(storage)).toEqual({ ...valid, theme: "system" });
    expect(storage.snapshot()).toBe(original);
  });

  it("safely defaults for future/unknown versions, corrupted or invalid JSON", () => {
    for (const raw of ["{", '{"version":999}', '{"version":1,"theme":"invalid"}']) {
      expect(readVisitorPreferences(memoryStorage(raw))).toEqual(defaultVisitorPreferences());
    }
    expect(parseVisitorPreferences({ ...valid, extra: "untrusted" })).toBeNull();
  });

  it("rejects invalid calendar dates, future dates, bad geography, country mismatch", () => {
    for (const birthDate of ["2001-02-29", "2027-01-01", "1900-00-01", "not-a-date"]) {
      expect(parseVisitorPreferences({ ...valid, birthDate })).toBeNull();
    }
    expect(parseVisitorPreferences({ ...valid, city: { ...paris, latitude: 100 } })).toBeNull();
    expect(parseVisitorPreferences({ ...valid, countryIso2: "BE" })).toBeNull();
    expect(parseVisitorPreferences({ ...valid, countryIso2: "fr" })).toBeNull();
  });

  it("never commits an invalid draft or saves when storage is blocked", () => {
    const storage = memoryStorage();
    expect(persistVisitorPreferences(storage, { ...valid, birthDate: "2001-02-29" }))
      .toEqual({ ok: false, reason: "invalid" });
    expect(storage.snapshot()).toBeUndefined();
    const blocked = {
      getItem: (_key: string): string | null => { throw new Error("blocked"); },
      setItem: (_key: string, _value: string): void => { throw new Error("quota"); },
    };
    expect(readVisitorPreferences(blocked)).toEqual(defaultVisitorPreferences());
    expect(persistVisitorPreferences(blocked, valid))
      .toEqual({ ok: false, reason: "unavailable" });
  });

  it("resets a single field only in memory; resets city when country changes", () => {
    const draft = resetVisitorPreference(valid, "birthDate");
    expect(draft.birthDate).toBeNull();
    expect(draft.city).toEqual(paris);
    expect(valid.birthDate).toBe("2000-02-29");
    expect(resetVisitorPreference(valid, "countryIso2").city).toBeNull();
    expect(changeVisitorCountry(valid, "BE")).toEqual({ ...valid, countryIso2: "BE", city: null });
    expect(changeVisitorCountry(valid, "FR").city).toEqual(paris);
  });
});
