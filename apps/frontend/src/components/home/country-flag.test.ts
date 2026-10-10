import { describe, expect, it } from "vitest";

import { countryFlagSrc, countryName } from "./country-flag";

describe("SCRUM-26 / SCRUM-27 — drapeau du pays de la source", () => {
  it("utilise le pays du média, indépendamment de la langue consultée", () => {
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru"]) {
      expect(countryFlagSrc("FR")).toBe("/country-flags/w160/fr.png");
      expect(countryName("FR", locale)).toBeTruthy();
    }
    expect(countryFlagSrc("de")).toBe("/country-flags/w160/de.png");
    expect(countryFlagSrc(" US ")).toBe("/country-flags/w160/us.png");
  });

  it("n'essaie pas de charger une image lorsqu'aucun code ISO2 n'est valable", () => {
    expect(countryFlagSrc(null)).toBeNull();
    expect(countryFlagSrc(undefined)).toBeNull();
    expect(countryFlagSrc("")).toBeNull();
    expect(countryFlagSrc("GB-ENG")).toBeNull();
    expect(countryFlagSrc("../../other")).toBeNull();
    expect(countryFlagSrc("F1")).toBeNull();
  });

  it("fournit une alternative textuelle avec le pays de la source", () => {
    expect(countryName("FR", "fr")).toBe("France");
    expect(countryName("FR", "en")).toBe("France");
    expect(countryName("DE", "fr")).toBe("Allemagne");
    expect(countryName("US", "en")).toBe("United States");
  });
});
