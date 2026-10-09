import {
  CATEGORY_HOME_LAYOUT_CAPACITY,
  DEFAULT_CATEGORY_HOME_COLOR,
  DEFAULT_CATEGORY_HOME_LAYOUT,
} from "@lmn24/contracts";
import { describe, expect, it } from "vitest";

import {
  CATEGORY_APPEARANCE_OPTIONS,
  DEFAULT_CATEGORY_APPEARANCE,
  isCategoryHomeLayout,
  normalizeThemeColor,
  validateCategoryAppearance,
} from "./category-appearance";

describe("SCRUM-24 — catalogue de présentation des catégories", () => {
  it("expose huit modèles avec une capacité identique au contrat partagé", () => {
    expect(CATEGORY_APPEARANCE_OPTIONS).toHaveLength(8);
    for (const option of CATEGORY_APPEARANCE_OPTIONS) {
      expect(option.capacity).toBe(CATEGORY_HOME_LAYOUT_CAPACITY[option.layoutType]);
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
    }
    expect(CATEGORY_APPEARANCE_OPTIONS.map((item) => item.capacity)).toEqual([
      5, 6, 5, 3, 5, 8, 10, 6,
    ]);
  });

  it("respecte les valeurs par défaut GRID et #2563EB", () => {
    expect(DEFAULT_CATEGORY_APPEARANCE).toEqual({
      layoutType: DEFAULT_CATEGORY_HOME_LAYOUT,
      themeColor: DEFAULT_CATEGORY_HOME_COLOR,
    });
  });

  it("valide les huit modèles et rejette toute valeur inconnue", () => {
    for (const option of CATEGORY_APPEARANCE_OPTIONS) {
      expect(isCategoryHomeLayout(option.layoutType)).toBe(true);
    }
    expect(isCategoryHomeLayout("CUSTOM")).toBe(false);
    expect(isCategoryHomeLayout(null)).toBe(false);
  });

  it("normalise le format hexadécimal en majuscules", () => {
    expect(normalizeThemeColor("  #aBc123  ")).toBe("#ABC123");
    expect(normalizeThemeColor("#123abc")).toBe("#123ABC");
  });

  it("rejette les formats CSS non conformes", () => {
    expect(normalizeThemeColor("#fff")).toBeNull();
    expect(normalizeThemeColor("red")).toBeNull();
    expect(normalizeThemeColor("#12345g")).toBeNull();
    expect(normalizeThemeColor("#12345678")).toBeNull();
  });

  it("valide layout et couleur ensemble sans paramètre de quantité", () => {
    expect(validateCategoryAppearance({ layoutType: "SPLIT", themeColor: "#abc123" })).toEqual({
      value: { layoutType: "SPLIT", themeColor: "#ABC123" },
      errors: {},
    });
    expect(
      validateCategoryAppearance({ layoutType: "UNKNOWN", themeColor: "red" }),
    ).toEqual({
      value: null,
      errors: {
        layoutType: expect.any(String),
        themeColor: expect.any(String),
      },
    });
  });
});
