import { describe, expect, it } from "vitest";
import {
  assertIanaZone, assertNumberAvailable, assertOfficialUrl, defaultVariantForCountry,
  effectiveChannelNumber, isTvAssociationPublic, newDiscoveredAssociation,
  nextAvailableNumber, resolveTvCountry,
} from "./tv-catalog-policy";

const countries = [
  { id: "fr", isoCode2: "FR", isActive: true },
  { id: "de", isoCode2: "DE", isActive: true },
  { id: "gb", isoCode2: "GB", isActive: false },
] as const;
const base = { channelId: "ch1", countryId: "fr", isActive: true, needsReview: false,
  manualNumber: null, officialNumber: 2, assignedNumber: 6, defaultVariantId: null };
describe("SCRUM-115 TV catalogue invariants", () => {
  it("follows preference then locale country then stable ISO2 fallback", () => {
    expect(resolveTvCountry(countries, "fr", "DE")?.id).toBe("fr");
    expect(resolveTvCountry(countries, "gb", "FR")?.id).toBe("fr");
    expect(resolveTvCountry(countries, "gb", "GB")?.id).toBe("de");
    expect(resolveTvCountry([{ id: "x", isoCode2: "FR", isActive: false }])).toBeNull();
  });
  it("applies MANUAL > OFFICIAL > ASSIGNED without overwriting corrections", () => {
    expect(effectiveChannelNumber(base)).toBe(2);
    expect(effectiveChannelNumber({ ...base, manualNumber: 12, officialNumber: 4 })).toBe(12);
    expect(effectiveChannelNumber({ ...base, manualNumber: null, officialNumber: null })).toBe(6);
  });
  it("allocates the smallest unused number and rejects conflicts and invalid numbers", () => {
    expect(nextAvailableNumber(new Set([1, 2, 4]))).toBe(3);
    expect(() => assertNumberAvailable(2, [base])).toThrow(/already assigned/);
    expect(() => assertNumberAvailable(2, [{ ...base, manualNumber: 9 }])).not.toThrow();
    expect(() => assertNumberAvailable(0, [])).toThrow();
    expect(() => nextAvailableNumber(new Set(), 0)).toThrow();
  });
  it("defaults newly discovered channels to inactive and needs review", () => {
    const discovered = newDiscoveredAssociation("x", "fr");
    expect(discovered.isActive).toBe(false);
    expect(discovered.needsReview).toBe(true);
    expect(isTvAssociationPublic(true, discovered)).toBe(false);
  });
  it("country disable hides associations without changing channel state", () => {
    expect(isTvAssociationPublic(true, base)).toBe(true);
    expect(isTvAssociationPublic(false, base)).toBe(false);
    expect(isTvAssociationPublic(true, { ...base, needsReview: true })).toBe(false);
  });
  it("chooses explicitly configured per-country variant or a stable valid fallback", () => {
    const variants = [
      { id: "west", channelId: "ch1", code: "west", isActive: true },
      { id: "east", channelId: "ch1", code: "east", isActive: true },
      { id: "other", channelId: "ch2", code: "a", isActive: true },
      { id: "disabled", channelId: "ch1", code: "z", isActive: false },
    ];
    expect(defaultVariantForCountry("ch1", "west", variants)?.id).toBe("west");
    expect(defaultVariantForCountry("ch1", "other", variants)?.id).toBe("east");
    expect(defaultVariantForCountry("ch1", "disabled", variants)?.id).toBe("east");
    expect(defaultVariantForCountry("ch3", null, variants)).toBeNull();
  });
  it("validates IANA zones including DST geographic regions", () => {
    expect(assertIanaZone("Europe/Paris")).toBe("Europe/Paris");
    expect(assertIanaZone("America/New_York")).toBe("America/New_York");
    expect(() => assertIanaZone("Fake/Timezone")).toThrow();
  });
  it("keeps URL fields optional but rejects credentials and local links", () => {
    expect(assertOfficialUrl(null)).toBeNull();
    expect(assertOfficialUrl("")).toBeNull();
    expect(assertOfficialUrl("https://example.org/live")).toBe("https://example.org/live");
    expect(() => assertOfficialUrl("javascript:alert(1)")).toThrow();
    expect(() => assertOfficialUrl("https://user:pass@example.org")).toThrow();
    expect(() => assertOfficialUrl("http://localhost:3000")).toThrow();
  });
});
