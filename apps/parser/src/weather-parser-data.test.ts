import { describe, expect, it } from "vitest";
import {
  weatherApiUrl, parseWeatherReading, parseWeatherBatch, weatherFiltersSchema,
} from "./weather-parser-data.js";

const now=new Date("2026-10-16T12:30:00Z");
function current(time=now.getTime()/1000){
 return {utc_offset_seconds:0,current:{
  time,temperature_2m:18.2,relative_humidity_2m:64,
  apparent_temperature:17.1,wind_speed_10m:6.2,weather_code:2,is_day:1
 }};
}
describe("SCRUM-71 Open-Meteo data contract",()=>{
 it("requests bounded coordinate batches and current UTC in explicit units",()=>{
  const url=new URL(weatherApiUrl([{latitude:48.8566,longitude:2.3522},
    {latitude:35.6762,longitude:139.6503}]));
  expect(url.hostname).toBe("api.open-meteo.com");
  expect(url.searchParams.get("latitude")).toBe("48.8566,35.6762");
  expect(url.searchParams.get("timeformat")).toBe("unixtime");
  expect(url.searchParams.get("timezone")).toBe("GMT");
  expect(url.searchParams.get("current")).toContain("weather_code");
  expect(()=>weatherApiUrl([])).toThrow();
  expect(()=>weatherApiUrl(Array.from({length:9},()=>({latitude:1,longitude:2})))).toThrow();
 });
 it("validates measurements, WMO code, is_day and UTC epoch",()=>{
  const reading=parseWeatherReading(current(),now);
  expect(reading.observedAt.toISOString()).toBe("2026-10-16T12:30:00.000Z");
  expect(reading.weatherCode).toBe(2);
  expect(reading.isDay).toBe(true);
  expect(reading.humidityPct).toBe(64);
 });
 it("accepts optional null fields while rejecting impossible measurements",()=>{
  const response=current();
  response.current.apparent_temperature=null as never;
  expect(parseWeatherReading(response,now).apparentTemperatureC).toBeNull();
  for(const altered of [
   {temperature_2m:1000},{relative_humidity_2m:110},
   {wind_speed_10m:-1},{is_day:2},{weather_code:121},
   {time:(now.getTime()+3*3600_000)/1000},
  ]){
   const test={...current(),current:{...current().current,...altered}};
   expect(()=>parseWeatherReading(test,now)).toThrow();
  }
  expect(()=>parseWeatherReading({utc_offset_seconds:3600,current:current().current},now)).toThrow();
 });
 it("accepts one object or aligned list but flags bad item individually",()=>{
  expect(parseWeatherBatch(current(),1,now)[0]?.reading?.temperatureC).toBe(18.2);
  const invalid={...current(),current:{...current().current,temperature_2m:"oops"}};
  const output=parseWeatherBatch([current(),invalid],2,now);
  expect(output.map(x=>x.reading!==null)).toEqual([true,false]);
  expect(()=>parseWeatherBatch([current()],2,now)).toThrow();
 });
 it("rejects invalid continent and extra request fields",()=>{
  expect(weatherFiltersSchema.safeParse({continentCode:"AF"}).success).toBe(true);
  expect(weatherFiltersSchema.safeParse({continentCode:"XX"}).success).toBe(false);
  expect(weatherFiltersSchema.safeParse({cron:"* * * * *"}).success).toBe(false);
 });
});
