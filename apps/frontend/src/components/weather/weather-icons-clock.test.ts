import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { formatCityLocalTime } from "./weather-clock";
import { weatherIconName, weatherIconPath, WEATHER_ICON_NAMES } from "./weather-icons";
import { weatherCopy } from "./weather-copy";

describe("SCRUM-76 — Static Meteocons Flat mapping", () => {
  it("ships each allowlisted static icon and its MIT notice locally", () => {
    for (const name of WEATHER_ICON_NAMES){
      expect(existsSync(join(process.cwd(),"public","weather-icons",name+".svg"))).toBe(true);
    }
    expect(existsSync(join(process.cwd(),"public","weather-icons","LICENSE-METEOCONS.txt"))).toBe(true);
  });
  it("uses the right solar/night icons, independent of visitor timezone", () => {
    expect(weatherIconName(0,true)).toBe("clear-day");
    expect(weatherIconName(0,false)).toBe("clear-night");
    expect(weatherIconName(1,true)).toBe("partly-cloudy-day");
    expect(weatherIconName(2,false)).toBe("partly-cloudy-night");
    expect(weatherIconName(3,true)).toBe("overcast");
    expect(weatherIconName(3,false)).toBe("overcast");
    expect(weatherIconName(45,false)).toBe("fog");
  });
  it("covers all supported WMO current codes, precipitation and hail", () => {
    const codes = [0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99];
    for(const code of codes) for(const isDay of [true,false]){
      expect(WEATHER_ICON_NAMES).toContain(weatherIconName(code,isDay));
      expect(weatherIconPath(code,isDay)).toMatch(/^\/weather-icons\/[a-z-]+\.svg$/);
    }
    expect(weatherIconName(51,true)).toBe("drizzle");
    expect(weatherIconName(66,true)).toBe("sleet");
    expect(weatherIconName(61,true)).toBe("rain");
    expect(weatherIconName(75,true)).toBe("snow");
    expect(weatherIconName(80,false)).toBe("partly-cloudy-night-rain");
    expect(weatherIconName(95,false)).toBe("thunderstorms-night");
    expect(weatherIconName(96,true)).toBe("thunderstorms-extreme");
  });
  it("never constructs an asset path from untrusted weather values", () => {
    for(const code of [null,undefined,-1,999,NaN,3.14]){
      expect(weatherIconName(code,false)).toBe("not-available");
      expect(weatherIconPath(code,false)).toBe("/weather-icons/not-available.svg");
    }
  });
});

describe("SCRUM-76 — city-local clocks", () => {
  it("uses each city's IANA timezone for the same instant", () => {
    const when=new Date("2026-10-16T12:05:00.000Z");
    expect(formatCityLocalTime(when,"Europe/Paris","fr")).toBe("14:05");
    expect(formatCityLocalTime(when,"Europe/London","en")).toBe("13:05");
    expect(formatCityLocalTime(when,"Asia/Tokyo","en")).toBe("21:05");
    expect(formatCityLocalTime(when,"America/New_York","en")).toBe("08:05");
  });
  it("handles DST transitions using Intl rather than fixed offsets", () => {
    expect(formatCityLocalTime(new Date("2026-03-29T00:30:00Z"),"Europe/Paris","fr")).toBe("01:30");
    expect(formatCityLocalTime(new Date("2026-03-29T01:30:00Z"),"Europe/Paris","fr")).toBe("03:30");
    expect(formatCityLocalTime(new Date("2026-10-25T00:30:00Z"),"Europe/Paris","fr")).toBe("02:30");
    expect(formatCityLocalTime(new Date("2026-10-25T01:30:00Z"),"Europe/Paris","fr")).toBe("02:30");
  });
  it("fails gracefully on invalid IANA zones and pre-hydration clock", () => {
    expect(formatCityLocalTime(null,"Europe/Paris","fr")).toBeNull();
    expect(formatCityLocalTime(new Date("invalid"),"Europe/Paris","fr")).toBeNull();
    expect(formatCityLocalTime(new Date(),"Moon/Unknown","fr")).toBeNull();
  });
  it("provides localized clock labels for every site language", () => {
    for(const locale of ["fr","en","de","es","it","pt","ru","nl"]){
      expect(weatherCopy(locale).localTime.length).toBeGreaterThan(3);
    }
  });
});
