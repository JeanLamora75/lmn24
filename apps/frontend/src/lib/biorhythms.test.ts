import { describe,expect,it } from "vitest";
import { BIORHYTHM_CYCLES,biorhythmWindow,cycleValue,isoAtDay,utcDay,validBirthDate } from "./biorhythms";

describe("SCRUM-111 — pure deterministic traditional biorhythms",()=>{
  it("uses 23, 28 and 33-day periods and starts at zero on birth day",()=>{
    expect(BIORHYTHM_CYCLES.map(c=>c.period)).toEqual([23,28,33]);
    const points=biorhythmWindow("2000-02-29","2000-02-29");
    expect(points).toHaveLength(31);
    expect(points[15]).toMatchObject({
      date:"2000-02-29",dayOffset:0,physical:0,emotional:0,intellectual:0,
    });
    expect(points[0]?.date).toBe("2000-02-14");
    expect(points[30]?.date).toBe("2000-03-15");
  });
  it("computes quarter period peaks, half period crossings and whole-period repeats",()=>{
    expect(cycleValue(7,28)).toBeCloseTo(100,7);
    expect(cycleValue(14,28)).toBeCloseTo(0,7);
    expect(cycleValue(21,28)).toBeCloseTo(-100,7);
    expect(cycleValue(28,28)).toBeCloseTo(0,7);
    for(const period of [23,28,33]){
      for(const d of [-200,-15,0,1,5,400]){
        expect(cycleValue(d+period,period)).toBeCloseTo(cycleValue(d,period),8);
      }
    }
    expect(()=>cycleValue(1,25)).toThrow();
    expect(()=>cycleValue(0.5,23)).toThrow();
  });
  it("handles leap dates, year changes and UTC calendar arithmetic",()=>{
    expect(utcDay("2000-02-29")).not.toBeNull();
    expect(utcDay("1900-02-29")).toBeNull();
    expect(utcDay("2024-02-29")).not.toBeNull();
    expect(utcDay("2023-02-29")).toBeNull();
    expect(utcDay("2000-04-31")).toBeNull();
    expect(utcDay("2000-13-01")).toBeNull();
    expect(utcDay("1899-12-31")).toBeNull();
    const dec=utcDay("2025-12-31"),jan=utcDay("2026-01-01");
    expect(jan! - dec!).toBe(1);
    expect(isoAtDay(jan!)).toBe("2026-01-01");
  });
  it("does not count daylight-saving transitions as unequal UTC days",()=>{
    for(const [a,b] of [["2026-03-28","2026-03-29"],["2026-10-24","2026-10-25"]] as const){
      expect(utcDay(b)!-utcDay(a)!).toBe(1);
      const p=biorhythmWindow("2000-02-29",b);
      expect(p[15]?.date).toBe(b);
      expect(p[14]?.date).toBe(a);
    }
  });
  it("validates birth dates and supports windows in the past",()=>{
    expect(validBirthDate("2000-02-29","2026-11-16")).toBe(true);
    expect(validBirthDate("2027-01-01","2026-11-16")).toBe(false);
    expect(validBirthDate("1900-01-01","2026-11-16")).toBe(true);
    expect(validBirthDate("bad","2026-11-16")).toBe(false);
    expect(biorhythmWindow("2000-01-01","1999-12-30")).toHaveLength(31);
    expect(()=>biorhythmWindow("bad","2026-11-16")).toThrow();
  });
});
