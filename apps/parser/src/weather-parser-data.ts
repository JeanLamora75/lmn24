import { z } from "zod";

export const weatherFiltersSchema = z.object({
  continentCode: z.enum(["EU", "AS", "AF", "NA", "SA", "OC"]).optional(),
}).strict();

export type WeatherFilters = z.infer<typeof weatherFiltersSchema>;
export type WeatherTrigger = "MANUAL" | "AUTOMATIC";

export const weatherCurrentSchema = z.object({
  time: z.number().int().positive(),
  temperature_2m: z.number().finite().min(-150).max(100),
  apparent_temperature: z.number().finite().min(-150).max(100).nullable().optional(),
  relative_humidity_2m: z.number().int().min(0).max(100).nullable().optional(),
  wind_speed_10m: z.number().finite().nonnegative().max(2000).nullable().optional(),
  weather_code: z.number().int().min(0).max(99),
  is_day: z.union([z.literal(0), z.literal(1)]),
});

const apiCitySchema = z.object({
  current: weatherCurrentSchema,
  utc_offset_seconds: z.number().int().optional(),
});

export type WeatherReading = {
  temperatureC: number;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  weatherCode: number;
  isDay: boolean;
  observedAt: Date;
};

export function parseWeatherReading(data: unknown, now:Date = new Date()):WeatherReading {
  const parsed=apiCitySchema.safeParse(data);
  if(!parsed.success)throw new Error("Réponse Open-Meteo invalide.");
  if(parsed.data.utc_offset_seconds!==undefined && parsed.data.utc_offset_seconds!==0)
    throw new Error("Réponse Open-Meteo non UTC.");
  const value=parsed.data.current;
  const observedAt=new Date(value.time*1000);
  if(!Number.isFinite(observedAt.getTime())
    || observedAt.getTime()>now.getTime()+2*3600_000
    || observedAt.getTime()<now.getTime()-48*3600_000)
    throw new Error("Date d'observation Open-Meteo incohérente.");
  return {
    temperatureC:value.temperature_2m,
    apparentTemperatureC:value.apparent_temperature??null,
    humidityPct:value.relative_humidity_2m??null,
    windSpeedKmh:value.wind_speed_10m??null,
    weatherCode:value.weather_code,
    isDay:value.is_day===1,
    observedAt,
  };
}

export function weatherApiUrl(cities:readonly {latitude:number;longitude:number}[]):string {
  if(!cities.length || cities.length>8)throw new Error("Taille de lot météo invalide.");
  const url=new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude",cities.map(c=>c.latitude.toString()).join(","));
  url.searchParams.set("longitude",cities.map(c=>c.longitude.toString()).join(","));
  url.searchParams.set("current","temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day");
  url.searchParams.set("temperature_unit","celsius");
  url.searchParams.set("wind_speed_unit","kmh");
  url.searchParams.set("timezone","GMT");
  url.searchParams.set("timeformat","unixtime");
  url.searchParams.set("forecast_days","1");
  return url.toString();
}

export function parseWeatherBatch(value:unknown, count:number, now=new Date()):
  Array<{reading:WeatherReading|null;error:string|null}> {
  const objects=count===1&&!Array.isArray(value)?[value]:value;
  if(!Array.isArray(objects)||objects.length!==count)
    throw new Error("Nombre de villes reçu différent du nombre demandé.");
  return objects.map(o=>{
    try{return {reading:parseWeatherReading(o,now),error:null};}
    catch(e){return {reading:null,error:e instanceof Error?e.message:"Données invalides"};}
  });
}
