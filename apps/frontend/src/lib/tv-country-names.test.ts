import {describe,expect,it} from "vitest";
import {loadTvCountryNames,normalizeTvCountryLocale,tvCountryName,TV_COUNTRY_LOCALES} from "./tv-country-names";

describe("Guide TV country labels from existing LMN24 i18n",()=>{
 it("loads the existing country namespace for every supported language",async()=>{
  for(const locale of TV_COUNTRY_LOCALES){
   const countries=await loadTvCountryNames(locale);
   expect(countries.FR,locale).toBeTruthy();
   expect(countries.DE,locale).toBeTruthy();
   expect(tvCountryName("de",locale,countries)).toBe(countries.DE);
  }
 });
 it("normalizes regional variants and uses the actual LMN24 translation",async()=>{
  expect(normalizeTvCountryLocale("de-DE")).toBe("de");
  expect(normalizeTvCountryLocale("es_MX")).toBe("es");
  const german=await loadTvCountryNames("de-DE");
  expect(tvCountryName("DE","de-DE",german)).toBe(german.DE);
  const french=await loadTvCountryNames("fr");
  expect(tvCountryName("DE","fr",french)).toBe("Allemagne");
 });
 it("falls back to Intl.DisplayNames for a missing key without inventing a translation",()=>{
  expect(tvCountryName("DE","en",{})).toBe("Germany");
  expect(tvCountryName("","fr",{})).toBe("");
  expect(tvCountryName("??","fr",{})).toBe("??");
 });
});
