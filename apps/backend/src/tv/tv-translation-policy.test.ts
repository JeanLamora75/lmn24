import {describe,it,expect} from "vitest";
import {retryLanguages,statusForLanguage,sanitizeTranslation} from "./tv-translation-policy";
describe("SCRUM-123 zero-loss translation policy",()=>{
 const descriptions=[
  {languageCode:"fr",content:"Source",origin:"SOURCE",version:"a"},
  {languageCode:"en",content:"Hand edited",origin:"MANUAL",version:"b"},
  {languageCode:"de",content:"Translated",origin:"MACHINE",version:"c"},
 ] as const;
 const attempts=[{languageCode:"es",status:"ERROR"},{languageCode:"nl",status:"UNSUPPORTED"}] as const;
 it("does not retry saved successful or MANUAL descriptions",()=>{
  expect(retryLanguages(descriptions,attempts,"fr")).toEqual(["es","pt","it","ru"]);
 });
 it("shows partial and unsupported statuses without pretending zero data exists",()=>{
  expect(statusForLanguage("en",descriptions,attempts)).toBe("MANUAL");
  expect(statusForLanguage("de",descriptions,attempts)).toBe("TRANSLATED");
  expect(statusForLanguage("es",descriptions,attempts)).toBe("FAILED");
  expect(statusForLanguage("nl",descriptions,attempts)).toBe("UNSUPPORTED");
  expect(statusForLanguage("pt",descriptions,attempts)).toBe("MISSING");
 });
 it("rejects empty, control and oversized provider responses",()=>{
  expect(sanitizeTranslation("  Bonjour  ")).toBe("Bonjour");
  expect(sanitizeTranslation("")).toBe(null);
  expect(sanitizeTranslation("abc\u0000")).toBe(null);
  expect(sanitizeTranslation("x".repeat(10001))).toBe(null);
 });
});
