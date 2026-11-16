import { describe, expect, it } from "vitest";
import { COUNTRY_ISO2, localizedCountries } from "@/lib/visitor-countries";
import { PREFERENCES_FORM_COPY } from "./visitor-preferences-copy";

describe("SCRUM-105 — preferences form localization and country catalog", () => {
  it("has an accessible translated action and validation copy in eight public locales", () => {
    expect(Object.keys(PREFERENCES_FORM_COPY).sort()).toEqual(
      ["de", "en", "es", "fr", "it", "nl", "pt", "ru"].sort(),
    );
    for (const copy of Object.values(PREFERENCES_FORM_COPY)) {
      for (const key of ["appearance", "country", "birthDate", "reset", "resetAll",
        "resetConfirm", "cancel", "save", "invalid", "unavailable", "saved", "conflict"]) {
        expect(copy[key as keyof typeof copy].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("provides stable ISO country codes without relying on the weather catalog", () => {
    expect(new Set(COUNTRY_ISO2).size).toBe(COUNTRY_ISO2.length);
    expect(COUNTRY_ISO2.length).toBeGreaterThan(200);
    for (const code of COUNTRY_ISO2) expect(code).toMatch(/^[A-Z]{2}$/);
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru", "nl"]) {
      const countries = localizedCountries(locale);
      expect(countries).toHaveLength(COUNTRY_ISO2.length);
      expect(countries.find((country) => country.code === "FR")?.name).toBeTruthy();
    }
  });
});
