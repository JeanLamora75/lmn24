import { describe, expect, it } from "vitest";
import { isTvPublicApiPath, isTvPublicPagePath, shouldBlockPublicTv, tvPublicEnabled } from "./tv-public-gate";

const locales = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"];
describe("Guide TV publicly accessible after owner GO", () => {
 it("allows public pages and API with no release configuration",()=>{
  expect(tvPublicEnabled({})).toBe(true);
  for(const locale of locales)expect(shouldBlockPublicTv("/"+locale+"/tv",{})).toBe(false);
  expect(shouldBlockPublicTv("/api/public/tv/schedule",{})).toBe(false);
 });
 it("still recognizes TV routes",()=>{
  expect(isTvPublicApiPath("/api/public/tv/schedule")).toBe(true);
  expect(isTvPublicPagePath("/fr/tv")).toBe(true);
 });
});
