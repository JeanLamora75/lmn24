import { describe, expect, it } from "vitest";
import { arrangeFavoriteCities, findCatalogFavorite, normalizeFavoriteWeather, favoriteWeatherInput } from "./favorite-weather";
import type { VisitorCity } from "@/lib/visitor-preferences";
import type { WeatherCity } from "./weather-data";
import type { WeatherRegion } from "./weather-copy";

const favorite: VisitorCity = {
  provider:"open-meteo-geocoding",providerId:"1850147",name:"Tokyo",
  region:"Tokyo",countryIso2:"JP",continent:"AS",latitude:35.68,
  longitude:139.69,timezone:"Asia/Tokyo",
};
const card = (name: string, countryIso2: string, continentCode: WeatherRegion, slug: string): WeatherCity => ({
  slug,name,countryIso2,continentCode,timezone:"Asia/Tokyo",displayOrder:1,
  latitude: 35.68, longitude: 139.69,
  freshness:"UNAVAILABLE",current:null,
});

describe("SCRUM-108 — city favorite matching", () => {
  it("reorders a unique same-country existing city without duplicating it", () => {
    const catalog = [card("Seoul","KR","AS","seoul"),card("Tokyo","JP","AS","tokyo"),
      card("Osaka","JP","AS","osaka")];
    const match=findCatalogFavorite(catalog,favorite);
    expect(match?.slug).toBe("tokyo");
    const result=arrangeFavoriteCities(catalog,favorite);
    expect(result.catalog.map(city=>city.slug)).toEqual(["tokyo","seoul","osaka"]);
    expect(result.catalog).toHaveLength(3);
  });
  it("never matches solely by name or on the wrong continent", () => {
    expect(findCatalogFavorite([card("Tokyo","US","NA","tokyo-us")],favorite)).toBeNull();
    expect(findCatalogFavorite([card("Tokyo","JP","EU","tokyo-eu")],favorite)).toBeNull();
    expect(findCatalogFavorite([card("Kyoto","JP","AS","kyoto")],favorite)).toBeNull();
    expect(findCatalogFavorite([{...card("Tokyo","JP","AS","tokyo-remote"),latitude:36.8}],favorite)).toBeNull();
  });
  it("does not wrongly merge multiple catalog homonyms", () => {
    const catalog=[card("Tokyo","JP","AS","tokyo1"),card("Tokyo","JP","AS","tokyo2")];
    expect(findCatalogFavorite(catalog,favorite)).toBeNull();
    expect(arrangeFavoriteCities(catalog,favorite).catalog).toEqual(catalog);
  });
  it("maps Open-Meteo observation into the shared weather card contract", () => {
    const observedAt=1763200000;
    const reading=normalizeFavoriteWeather({
      timezone:"Asia/Tokyo",
      current:{time:observedAt,temperature_2m:16.5,apparent_temperature:15,
        relative_humidity_2m:64,wind_speed_10m:10.3,weather_code:3,is_day:1}
    },favorite,"2026-11-16T15:00:00.000Z");
    expect(reading.slug).toBe("favorite-1850147");
    expect(reading.continentCode).toBe("AS");
    expect(reading.freshness).toBe("FRESH");
    expect(reading.current?.temperatureC).toBe(16.5);
    expect(reading.current?.observedAt).toBe(new Date(observedAt*1000).toISOString());
  });
  it("rejects invalid coordinates or malformed API observations", () => {
    expect(favoriteWeatherInput.safeParse({...favorite,latitude:111}).success).toBe(false);
    expect(favoriteWeatherInput.safeParse({...favorite,birthDate:"1990-01-01"}).success).toBe(false);
    expect(()=>normalizeFavoriteWeather({timezone:"Asia/Tokyo",current:{time:NaN}},favorite,new Date().toISOString())).toThrow();
  });
});
