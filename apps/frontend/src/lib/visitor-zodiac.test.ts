import { describe, expect, it } from "vitest";
import { WESTERN_ZODIAC_SIGNS, zodiacSignFromBirthDate } from "./visitor-zodiac";

describe("SCRUM-109 — privacy-preserving Western zodiac calculation", () => {
  it("returns the expected twelve signs at each entry and exit boundary", () => {
    const cases = [
      ["01-19","capricorn"],["01-20","aquarius"],["02-18","aquarius"],
      ["02-19","pisces"],["03-20","pisces"],["03-21","aries"],
      ["04-19","aries"],["04-20","taurus"],["05-20","taurus"],
      ["05-21","gemini"],["06-20","gemini"],["06-21","cancer"],
      ["07-22","cancer"],["07-23","leo"],["08-22","leo"],
      ["08-23","virgo"],["09-22","virgo"],["09-23","libra"],
      ["10-22","libra"],["10-23","scorpio"],["11-21","scorpio"],
      ["11-22","sagittarius"],["12-21","sagittarius"],["12-22","capricorn"],
      ["12-31","capricorn"],
    ] as const;
    for (const [day, sign] of cases) {
      expect(zodiacSignFromBirthDate("2000-" + day)).toBe(sign);
    }
    expect(WESTERN_ZODIAC_SIGNS).toHaveLength(12);
    expect(new Set(WESTERN_ZODIAC_SIGNS).size).toBe(12);
  });

  it("accepts leap-day births and rejects non-existent dates", () => {
    expect(zodiacSignFromBirthDate("2000-02-29")).toBe("pisces");
    expect(zodiacSignFromBirthDate("2001-02-29")).toBeNull();
    expect(zodiacSignFromBirthDate("1900-02-29")).toBeNull();
    expect(zodiacSignFromBirthDate("2024-02-29")).toBe("pisces");
    for (const value of ["2000-04-31","2000-13-01","2000-00-01","2000-01-00","1899-12-31","2000-2-20","not a date","",null,undefined]) {
      expect(zodiacSignFromBirthDate(value)).toBeNull();
    }
  });

  it("rejects future birth dates", () => {
    expect(zodiacSignFromBirthDate("2999-01-01")).toBeNull();
  });

  it("never needs network access, a persisted sign or an external service", () => {
    expect(zodiacSignFromBirthDate("1992-05-21")).toBe("gemini");
    expect(zodiacSignFromBirthDate("1992-05-20")).toBe("taurus");
  });
});
