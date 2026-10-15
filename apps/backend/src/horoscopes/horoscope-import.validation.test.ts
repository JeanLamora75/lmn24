import { describe, expect, it } from "vitest";
import { validateHoroscopeJson } from "./horoscope-import.validation";
import { HOROSCOPE_LOCALES, HOROSCOPE_SIGNS } from "./public-horoscopes.service";

function fixture() {
  return {
    date:"2026-10-15",generatedAt:"2026-10-14T22:00:00+02:00",timezone:"Europe/Paris",
    astronomy:{validationStatus:"PARTIAL",attribution:{text:"Astronomical data: CosmyDay",url:"https://cosmyday.com"}},
    horoscopes:HOROSCOPE_SIGNS.flatMap(sign=>HOROSCOPE_LOCALES.map(language=>({
      date:"2026-10-15",sign,language,general:"A",love:"B",work:"C",finance:"D",disclaimer:"Divertissement",
    }))),
  };
}
describe("horoscope JSON validation",()=>{
  it("accepts 96 distinct sign/locale pairs including PARTIAL astronomy",()=>{
    const parsed=validateHoroscopeJson(JSON.stringify(fixture()),"horoscopes-2026-10-15.json");
    expect(parsed.data.horoscopes).toHaveLength(96);
    expect(parsed.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects duplicate combinations",()=>{
    const source=fixture();
    const first = source.horoscopes[0];
    if (!first) throw new Error("Horoscope test fixture is empty");
    source.horoscopes[1] = first;
    expect(()=>validateHoroscopeJson(JSON.stringify(source),"horoscopes-2026-10-15.json")).toThrow();
  });
  it("rejects a mismatched file date",()=>{
    expect(()=>validateHoroscopeJson(JSON.stringify(fixture()),"horoscopes-2026-10-16.json")).toThrow();
  });
});
