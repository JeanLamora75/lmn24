import { describe, expect, it } from "vitest";
import { WESTERN_ZODIAC_SIGNS } from "@/lib/visitor-zodiac";
import { VISITOR_ZODIAC_PREVIEW } from "./visitor-zodiac-copy";

describe("SCRUM-109 — horoscope preference translations", () => {
  it("provides an understandable sign preview in all eight public locales", () => {
    expect(Object.keys(VISITOR_ZODIAC_PREVIEW).sort()).toEqual(
      ["fr","en","de","es","pt","it","ru","nl"],
    );
    for (const translation of Object.values(VISITOR_ZODIAC_PREVIEW)) {
      expect(translation.heading.trim().length).toBeGreaterThan(3);
      expect(Object.keys(translation.signs).sort()).toEqual([...WESTERN_ZODIAC_SIGNS].sort());
      for (const sign of WESTERN_ZODIAC_SIGNS) {
        expect(translation.signs[sign].trim().length).toBeGreaterThan(2);
      }
    }
  });
});
