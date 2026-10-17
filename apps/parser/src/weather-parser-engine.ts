import type { GlobalParserLease } from "./global-parser-lock.js";
import type { DatabaseClient } from "@lmn24/database";
import { randomUUID } from "node:crypto";
import { safeLogText } from "./persistent-run-log.js";
import {
  parseWeatherBatch, weatherApiUrl, type WeatherFilters,
  type WeatherReading, type WeatherTrigger
} from "./weather-parser-data.js";

export class WeatherRunActiveError extends Error {
  constructor() { super("Une extraction météo est déjà en cours."); this.name="WeatherRunActiveError"; }
}
type City={id:string;name:string;latitude:number;longitude:number};
type Counters={totalCities:number;processedCities:number;successfulCities:number;failedCities:number};
const BATCH_SIZE=8;
const REQUEST_ATTEMPTS=3;
const TIMEOUT_MS=15_000;
const RETRY_DELAYS_MS=[1_500,4_000] as const;
const MAX_RETRY_AFTER_MS=30_000;
const MAX_BYTES=250_000;
const ACTIVE_TTL_MS=45*60_000;
const retryable=(status:number)=>status===429||status>=500;

class PermanentWeatherHttpError extends Error {}

function retryAfterMs(response:Response):number|null {
  const raw=response.headers.get("retry-after")?.trim();
  if(!raw)return null;
  const seconds=Number(raw);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
  const date=Date.parse(raw);
  return Number.isFinite(date)?Math.max(0,date-Date.now()):null;
}

async function providerReason(response:Response):Promise<string|null> {
  // A structured Open-Meteo error may explain which argument or quota failed.
  // Never forward arbitrary upstream HTML as an error message.
  const type=response.headers.get("content-type")?.toLowerCase()??"";
  const length=Number(response.headers.get("content-length")??0);
  if(!type.includes("json") || length>2048)return null;
  try {
    const body:unknown=await response.json();
    if(typeof body!=="object"||body===null||!("reason" in body))return null;
    const reason=(body as {reason:unknown}).reason;
    return typeof reason==="string"
      ? reason.replace(/[\r\n\t]+/g," ").trim().slice(0,200)||null
      : null;
  }catch{return null;}
}

function readableWeatherError(error:unknown):Error {
  if(!(error instanceof Error))return new Error("Open-Meteo : erreur réseau inconnue.");
  if(error.name==="TimeoutError"||error.name==="AbortError")
    return new Error("Open-Meteo : délai dépassé ("+(TIMEOUT_MS/1000)+" s par tentative)");
  if(error.message==="fetch failed") {
    const cause=error.cause as {code?:unknown}|undefined;
    const code=typeof cause?.code==="string" ? cause.code : null;
    return new Error("Connexion Open-Meteo impossible"+(code?" ("+code+")":""));
  }
  return error;
}

/** Bounded retries for temporary upstream failures; permanent HTTP errors fail immediately. */
export async function weatherHttp(
  cities:City[],
  requester:typeof fetch=fetch,
):Promise<unknown> {
  const url=weatherApiUrl(cities);
  let lastError:Error=new Error("Open-Meteo indisponible.");
  for(let attempt=0;attempt<REQUEST_ATTEMPTS;attempt++){
    let minimumDelay=0;
    try{
      const response=await requester(url,{
        signal:AbortSignal.timeout(TIMEOUT_MS),
        redirect:"error",
        headers:{accept:"application/json","user-agent":"LMN24-Weather/1.0 (non-commercial)"}
      });
      if(!response.ok){
        const reason=await providerReason(response);
        const message="Open-Meteo HTTP "+response.status+(reason?" : "+reason:"");
        if(!retryable(response.status))throw new PermanentWeatherHttpError(message);
        const retryAfter=retryAfterMs(response);
        if(retryAfter!==null&&retryAfter>MAX_RETRY_AFTER_MS)
          throw new PermanentWeatherHttpError(
            message+" (Retry-After trop long : différer la prochaine collecte)"
          );
        minimumDelay=retryAfter??0;
        lastError=new Error(message);
      }else{
        const length=Number(response.headers.get("content-length"));
        if(Number.isFinite(length)&&length>MAX_BYTES)
          throw new PermanentWeatherHttpError("Réponse météo trop volumineuse.");
        // Limit the response before parsing to avoid excessive JSON allocations.
        const body=await response.text();
        if(body.length>MAX_BYTES)
          throw new PermanentWeatherHttpError("Réponse météo trop volumineuse.");
        return JSON.parse(body) as unknown;
      }
    }catch(error){
      if(error instanceof PermanentWeatherHttpError)throw error;
      // An invalid JSON payload is diagnosed as an upstream error, not retried.
      if(error instanceof SyntaxError)
        throw new Error("Réponse JSON Open-Meteo invalide.");
      lastError=readableWeatherError(error);
    }
    if(attempt+1<REQUEST_ATTEMPTS){
      const delay=Math.max(RETRY_DELAYS_MS[attempt]??4_000,minimumDelay);
      await new Promise<void>(resolve=>setTimeout(resolve,delay));
    }
  }
  throw new Error(lastError.message+" ("+REQUEST_ATTEMPTS+" tentatives)");
}

export class WeatherParserEngine {
  constructor(
    private readonly db:DatabaseClient,
    private readonly fetchBatch:(cities:City[])=>Promise<unknown>=weatherHttp,
  ) {}

  // PostgreSQL serializes the "check active then create" transaction even when
  // several parser instances try to start at the same time.
  async start(filters:WeatherFilters={},trigger:WeatherTrigger="MANUAL", lease?:GlobalParserLease):Promise<string> {
    const started=await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(241024,71)`;
      const cutoff=new Date(Date.now()-ACTIVE_TTL_MS);
      await tx.weatherRun.updateMany({
        where:{status:"RUNNING",startedAt:{lt:cutoff}},
        data:{status:"INTERRUPTED",finishedAt:new Date(),errorMessage:"Exécution interrompue ou expirée."}
      });
      if(await tx.weatherRun.count({where:{status:"RUNNING"}})>0)
        throw new WeatherRunActiveError();
      const rows=await tx.weatherCity.findMany({
        where:{isActive:true,...(filters.continentCode?{continentCode:filters.continentCode}:{})},
        orderBy:[{continentCode:"asc"},{displayOrder:"asc"}],
        select:{id:true,name:true,latitude:true,longitude:true}
      });
      const cities:City[]=rows.map(c=>({
        id:c.id,name:c.name,latitude:Number(c.latitude),longitude:Number(c.longitude)
      }));
      const id=randomUUID();
      await tx.weatherRun.create({data:{
        id,trigger,continentCode:filters.continentCode??null,
        totalCities:cities.length,status:"RUNNING"
      }});
      return {id,cities};
    },{maxWait:10000,timeout:15000});
    // Request caller receives the id immediately; all progress is persisted.
    void this.execute(started.id,started.cities).catch(async e=>{
      const message=safeLogText(e instanceof Error?e.message:String(e));
      try{
        await this.db.weatherRun.update({
          where:{id:started.id},data:{
            finishedAt:new Date(),status:"ERROR",errorMessage:message
          }
        });
      }catch(err){console.error("Weather run completion persistence failed:",err);}
    }).finally(async () => { await lease?.release(); });
    return started.id;
  }

  async get(id:string) {
    return this.db.weatherRun.findUnique({where:{id}});
  }

  async latest(take=20) {
    return this.db.weatherRun.findMany({
      orderBy:{startedAt:"desc"},take:Math.max(1,Math.min(take,100))
    });
  }

  private async save(city:City,reading:WeatherReading) {
    // Single SQL statement prevents older observations from overwriting newer data.
    const fetchedAt=new Date();
    await this.db.$executeRaw`
      INSERT INTO weather_current
        (city_id,temperature_c,apparent_temperature_c,humidity_pct,
          wind_speed_kmh,weather_code,is_day,observed_at,fetched_at,provider)
      VALUES
        (${city.id}::uuid,${reading.temperatureC},${reading.apparentTemperatureC},
         ${reading.humidityPct},${reading.windSpeedKmh},${reading.weatherCode},
         ${reading.isDay},${reading.observedAt},${fetchedAt},'OPEN_METEO')
      ON CONFLICT (city_id) DO UPDATE SET
        temperature_c=EXCLUDED.temperature_c,
        apparent_temperature_c=EXCLUDED.apparent_temperature_c,
        humidity_pct=EXCLUDED.humidity_pct,
        wind_speed_kmh=EXCLUDED.wind_speed_kmh,
        weather_code=EXCLUDED.weather_code,
        is_day=EXCLUDED.is_day,
        observed_at=EXCLUDED.observed_at,
        fetched_at=EXCLUDED.fetched_at,
        provider=EXCLUDED.provider
      WHERE weather_current.observed_at <= EXCLUDED.observed_at
    `;
  }

  private async execute(id:string,cities:City[]) {
    const counters:Counters={
      totalCities:cities.length,processedCities:0,successfulCities:0,failedCities:0
    };
    const errors:string[]=[];
    for(let offset=0;offset<cities.length;offset+=BATCH_SIZE) {
      const group=cities.slice(offset,offset+BATCH_SIZE);
      try{
        const response=await this.fetchBatch(group);
        const checked=parseWeatherBatch(response,group.length);
        for(const [index,city] of group.entries()) {
          if(!city)continue;
          const result=checked[index];
          try{
            if(!result?.reading)throw new Error(result?.error??"Lecture météo absente.");
            await this.save(city,result.reading);
            counters.successfulCities++;
          }catch(e){
            counters.failedCities++;
            errors.push(city.name+": "+safeLogText(e instanceof Error?e.message:String(e)));
          }
          counters.processedCities++;
        }
      }catch(e){
        const detail=safeLogText(e instanceof Error?e.message:String(e));
        counters.failedCities+=group.length;
        counters.processedCities+=group.length;
        for(const city of group)errors.push(city.name+": "+detail);
      }
      await this.db.weatherRun.update({
        where:{id},
        data:{
          processedCities:counters.processedCities,
          successfulCities:counters.successfulCities,
          failedCities:counters.failedCities,
          errorMessage:errors.length?safeLogText(errors.slice(0,6).join(" | ")):null
        }
      });
    }
    const status=counters.failedCities===0?"SUCCESS":
      counters.successfulCities===0?"ERROR":"PARTIAL";
    await this.db.weatherRun.update({where:{id},data:{
      finishedAt:new Date(),status,
      errorMessage:errors.length?safeLogText(errors.slice(0,6).join(" | ")):null
    }});
  }
}
