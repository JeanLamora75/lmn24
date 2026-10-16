"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WEATHER_CONTINENT_COOKIE, WEATHER_COOKIE_MAX_AGE,
  type WeatherSelection,
} from "./weather-region-choice";
import { CountryFlag } from "@/components/home/CountryFlag";
import { WEATHER_REGIONS, weatherCondition, weatherCopy, type WeatherRegion } from "./weather-copy";
import { parseWeatherResponse, type WeatherResponse, type WeatherCity } from "./weather-data";
import styles from "./weather.module.css";

function dateLabel(instant:string,locale:string):string{
  const time=new Date(instant);
  return Number.isNaN(time.getTime())?"—":new Intl.DateTimeFormat(locale,{
    dateStyle:"short",timeStyle:"short"
  }).format(time);
}
function value(number:number):string{
  return Number.isFinite(number)?Math.round(number)+"°C":"—";
}
function WeatherCard({city,locale}:{city:WeatherCity;locale:string}){
  const t=weatherCopy(locale);
  const reading=city.current;
  const available=reading!==null && city.freshness!=="UNAVAILABLE";
  return <article className={"card h-100 shadow-sm "+styles.weatherCard}>
    <div className="card-body d-flex flex-column p-3 p-lg-4">
      <div className="d-flex align-items-center gap-2 mb-3">
        <CountryFlag countryIsoCode2={city.countryIso2} locale={locale}/>
        <div className="min-w-0">
          <h2 className="h5 mb-0 text-break">{city.name}</h2>
          <span className="text-body-secondary small">{city.countryIso2}</span>
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <span className={styles.temperature}>
            {available&&reading?value(reading.temperatureC):"—"}
          </span>
          <p className="text-body-secondary mb-0">
            {available&&reading?t.conditions[weatherCondition(reading.weatherCode)]:t.unavailable}
          </p>
        </div>
        <div className={styles.conditions}>
          {city.freshness==="STALE"&&<span className="badge text-bg-warning">{t.oldData}</span>}
          {city.freshness==="UNAVAILABLE"&&<span className="badge text-bg-secondary">{t.unavailable}</span>}
        </div>
      </div>
      {available&&reading&&<dl className={"row row-cols-2 g-2 small mt-auto mb-3 "+styles.details}>
        <div className="col">
          <dt>{t.felt}</dt><dd>{reading.apparentTemperatureC===null?"—":value(reading.apparentTemperatureC)}</dd>
        </div>
        <div className="col">
          <dt>{t.humidity}</dt><dd>{reading.humidityPct===null?"—":reading.humidityPct+" %"}</dd>
        </div>
        <div className="col">
          <dt>{t.wind}</dt><dd>{reading.windSpeedKmh===null?"—":Math.round(reading.windSpeedKmh)+" km/h"}</dd>
        </div>
      </dl>}
      <div className={"small text-body-secondary pt-2 mt-auto "+styles.observed}>
        {reading?t.updated+" : "+dateLabel(reading.observedAt,locale):t.unavailable}
      </div>
    </div>
  </article>;
}

export function PublicWeather({
  locale, initialData, initialContinent, initialMode, initialSource,
}:{
  locale:string;
  initialData:WeatherResponse|null;
  initialContinent:WeatherRegion;
  initialMode:WeatherSelection["mode"];
  initialSource:WeatherSelection["source"];
}){
  const router=useRouter();
  const t=weatherCopy(locale);
  // Server and client share the same initial continent: no hydration mismatch or
  // flash of Europe's data when a preference or trusted GeoIP says otherwise.
  const [continent,setContinent]=useState<WeatherRegion>(initialContinent);
  const [mode,setMode]=useState<WeatherSelection["mode"]>(initialMode);
  const [resetting,setResetting]=useState(false);
  const [data,setData]=useState<WeatherResponse|null>(initialData);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(initialData===null);
  const requestId=useRef(0);
  const controller=useRef<AbortController|null>(null);

  // Abort in-flight network requests on unmount and when a different continent is selected.
  useEffect(()=>()=>{controller.current?.abort();},[]);

  function selectManually(next:WeatherRegion){
    // A first-party, non-identifying browser cookie is visible to the SSR
    // request and preserved across languages and browser restarts.
    const secure=window.location.protocol==="https:"?"; Secure":"";
    document.cookie=WEATHER_CONTINENT_COOKIE+"="+next+
      "; path=/; max-age="+WEATHER_COOKIE_MAX_AGE+"; SameSite=Lax"+secure;
    setMode("manual");
    void load(next);
  }

  function restoreAutomatic(){
    // Removing the cookie restores trusted proxy GeoIP, or Europe if absent.
    const secure=window.location.protocol==="https:"?"; Secure":"";
    document.cookie=WEATHER_CONTINENT_COOKIE+
      "=; path=/; max-age=0; SameSite=Lax"+secure;
    controller.current?.abort();
    setResetting(true);
    router.refresh();
  }

  async function load(next:WeatherRegion){
    controller.current?.abort();
    const abort=new AbortController();
    controller.current=abort;
    const id=++requestId.current;
    setContinent(next);
    setData(null);
    setError(false);
    setLoading(true);
    try{
      const response=await fetch("/api/public/weather?continent="+encodeURIComponent(next),{
        signal:abort.signal,cache:"no-store"
      });
      if(!response.ok)throw new Error("Weather service unavailable.");
      const raw:unknown=await response.json();
      const payload=parseWeatherResponse(raw,next);
      if(id===requestId.current&&!abort.signal.aborted)setData(payload);
    }catch{
      if(id===requestId.current&&!abort.signal.aborted)setError(true);
    }finally{
      if(id===requestId.current&&!abort.signal.aborted)setLoading(false);
    }
  }
  return <main className="container px-3 px-lg-4 pb-5">
    <header className={styles.intro}>
      <span className="text-primary fw-semibold small">LMN24 · {t.current}</span>
      <h1 className={styles.title}>{t.title}</h1>
      <p className="text-body-secondary lead mb-0">{t.description}</p>
    </header>
    <section aria-label={t.choose}>
      <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap mb-4">
        <div className={styles.selector}>
          <label className="form-label fw-semibold" htmlFor="weather-continent">{t.choose}</label>
          <select id="weather-continent" className="form-select form-select-lg" value={continent}
            disabled={resetting} onChange={e=>selectManually(e.target.value as WeatherRegion)}>
            {WEATHER_REGIONS.map(region=><option key={region} value={region}>
              {t.regions[region]}
            </option>)}
          </select>
        </div>
        <div className="d-flex flex-column align-items-start align-items-md-end gap-2">
          <span className="badge rounded-pill text-bg-light border text-secondary"
            aria-live="polite">
            {mode==="manual"?t.modeManual:
              initialSource==="geoip"?t.autoDetected:t.autoFallback}
          </span>
          {mode==="manual"&&<button type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={resetting} onClick={restoreAutomatic}>
            {t.resetAutomatic}
          </button>}
          <div className="text-body-secondary small" aria-live="polite">
            {!loading&&data&&data.items.length>0
              ?t.regions[continent]+" · "+data.items.length+" "+t.cities :null}
          </div>
        </div>
      </div>
      {loading&&<div className="d-flex align-items-center gap-3 py-5" role="status">
        <span className="spinner-border text-primary" aria-hidden="true"/>
        <span>{t.loading}</span>
      </div>}
      {!loading&&error&&<div className="alert alert-danger d-flex flex-wrap gap-3 align-items-center"
        role="alert"><span>{t.error}</span>
        <button className="btn btn-outline-danger btn-sm" type="button"
          onClick={()=>void load(continent)}>{t.retry}</button>
      </div>}
      {!loading&&!error&&data&&data.items.length===0&&
        <p className="alert alert-info" role="status">{t.empty}</p>}
      {!loading&&!error&&data&&data.items.length>0&&
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 g-lg-4">
          {data.items.map(city=><div className="col" key={city.slug}>
            <WeatherCard city={city} locale={locale}/>
          </div>)}
        </div>}
    </section>
    <footer className="pt-4 mt-2 text-body-secondary small">
      {t.provider}{" "}
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
        Open-Meteo <span aria-hidden="true">↗</span>
      </a>
    </footer>
  </main>;
}
