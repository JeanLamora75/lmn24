import { WEATHER_REGIONS, type WeatherRegion } from "./weather-copy";

export type WeatherReading = {
  temperatureC:number; apparentTemperatureC:number|null;
  humidityPct:number|null; windSpeedKmh:number|null;
  weatherCode:number; isDay:boolean;
  observedAt:string; fetchedAt:string; provider:string;
};
export type WeatherCity = {
  slug:string; name:string;countryIso2:string;
  continentCode:WeatherRegion;timezone:string;displayOrder:number;
  freshness:"FRESH"|"STALE"|"UNAVAILABLE";current:WeatherReading|null;
};
export type WeatherResponse = {
  continent:WeatherRegion;
  generatedAt:string;
  staleAfterMinutes:number;
  attribution:{name:string;url:string};
  count:number;
  items:WeatherCity[];
};

export function isWeatherRegion(value:string): value is WeatherRegion{
  return (WEATHER_REGIONS as readonly string[]).includes(value);
}
/** Defensive check for public responses; rejects mismatched regions. */
export function parseWeatherResponse(input:unknown,region:WeatherRegion):WeatherResponse{
  if(!input||typeof input!=="object")throw new Error("Invalid weather response.");
  const r=input as Partial<WeatherResponse>;
  if(r.continent!==region || !Array.isArray(r.items))throw new Error("Invalid weather region.");
  if(!r.items.every(item=>item && typeof item.slug==="string" &&
      typeof item.name==="string" && typeof item.countryIso2==="string" &&
      typeof item.timezone==="string" && item.continentCode===region &&
      (item.freshness==="FRESH"||item.freshness==="STALE"||item.freshness==="UNAVAILABLE") &&
      (item.current===null || (item.current!==undefined &&
        typeof item.current.temperatureC==="number" &&
        typeof item.current.weatherCode==="number" &&
        typeof item.current.observedAt==="string")))) {
    throw new Error("Invalid weather city.");
  }
  if(typeof r.generatedAt!=="string"||!r.attribution||
      r.attribution.name!=="Open-Meteo"||r.attribution.url!=="https://open-meteo.com/"||
      typeof r.staleAfterMinutes!=="number"){
    throw new Error("Invalid weather metadata.");
  }
  return r as WeatherResponse;
}
