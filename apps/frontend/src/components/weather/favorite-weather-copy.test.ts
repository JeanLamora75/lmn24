import { describe, expect, it } from "vitest";
import { FAVORITE_WEATHER_COPY, favoriteWeatherCopy } from "./favorite-weather-copy";

describe("SCRUM-108 — highlighted favorite card localization",()=>{
  it("labels favorite, loading, error and return action in all eight locales",()=>{
    const expected=["fr","en","de","es","pt","it","ru","nl"];
    expect(Object.keys(FAVORITE_WEATHER_COPY).sort()).toEqual(expected.sort());
    for(const locale of expected){
      const copy=favoriteWeatherCopy(locale);
      for(const key of ["badge","selected","returnToFavorite","loading","unavailable","retry"] as const){
        expect(copy[key].trim().length).toBeGreaterThan(2);
      }
    }
  });
  it("falls back to French for unknown languages",()=>{
    expect(favoriteWeatherCopy("xx")).toEqual(favoriteWeatherCopy("fr"));
  });
});
