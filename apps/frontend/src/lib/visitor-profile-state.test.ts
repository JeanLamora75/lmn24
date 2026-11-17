import { describe, expect, it } from "vitest";
import {
  defaultVisitorPreferences, hasVisitorPreferences, parseVisitorPreferences,
} from "./visitor-preferences";

const category = "11111111-1111-4111-8111-111111111111";

describe("LMN24 profile trigger visual state", () => {
  const empty = defaultVisitorPreferences();

  it("remains visually inactive with no saved choices, even if an empty profile record exists", () => {
    expect(hasVisitorPreferences(empty)).toBe(false);
    expect(hasVisitorPreferences(parseVisitorPreferences(empty)!)).toBe(false);
    expect(hasVisitorPreferences(parseVisitorPreferences({
      version: 1, theme: null, countryIso2: null, city: null, birthDate: null,
    })!)).toBe(false);
  });

  it("activates when any individual preference is set", () => {
    expect(hasVisitorPreferences({ ...empty, theme: "system" })).toBe(true);
    expect(hasVisitorPreferences({ ...empty, theme: "light" })).toBe(true);
    expect(hasVisitorPreferences({ ...empty, countryIso2: "FR" })).toBe(true);
    expect(hasVisitorPreferences({ ...empty, birthDate: "2000-02-29" })).toBe(true);
    expect(hasVisitorPreferences({ ...empty, categories: { order: [category], hidden: [] } })).toBe(true);
    expect(hasVisitorPreferences({ ...empty, categories: { order: [], hidden: [category] } })).toBe(true);
  });

  it("returns to inactive after all preferences are reset", () => {
    const configured = { ...empty, theme: "dark" as const, birthDate: "2000-02-29" };
    expect(hasVisitorPreferences(configured)).toBe(true);
    expect(hasVisitorPreferences(defaultVisitorPreferences())).toBe(false);
  });
});
