import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountryFlag } from "../home/CountryFlag";
import { WeatherCard } from "./PublicWeather";
import type { WeatherCity } from "./weather-data";

const city:WeatherCity={
  slug:"sydney", name:"Sydney",countryIso2:"AU",continentCode:"OC",
  timezone:"Australia/Sydney",displayOrder:1,freshness:"FRESH",
  current:{temperatureC:16,apparentTemperatureC:15,humidityPct:68,
    windSpeedKmh:12,weatherCode:0,isDay:false,
    observedAt:"2026-10-16T11:45:00Z",fetchedAt:"2026-10-16T11:47:00Z",provider:"OPEN_METEO"},
};

describe("Weather card compact redesign",()=>{
  it("keeps default news/source flags small and gives weather flags a two-line height",()=>{
    const compact=renderToStaticMarkup(createElement(CountryFlag,{
      countryIsoCode2:"AU",locale:"fr",
    }));
    const large=renderToStaticMarkup(createElement(CountryFlag,{
      countryIsoCode2:"AU",locale:"fr",size:"large",
    }));
    expect(compact).toContain('width="24"');
    expect(compact).toContain('height="18"');
    expect(large).toContain('width="88"');
    expect(large).toContain('height="48"');
    expect(large).toContain("/country-flags/w160/au.png");
  });

  it("shows larger country flag, local time and three weather metrics in one grid",()=>{
    const html=renderToStaticMarkup(createElement(WeatherCard,{
      city,locale:"fr",now:new Date("2026-10-16T10:48:00Z"),
    }));
    expect(html).toContain('width="88"');
    expect(html).toContain('height="48"');
    expect(html).toContain("Sydney");
    expect(html).toContain("Heure locale");
    expect(html).toContain("21:48");
    const metricRow=html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/)?.[1];
    expect(metricRow).toBeTruthy();
    expect((metricRow?.match(/<dt>/g)||[])).toHaveLength(3);
    expect(metricRow).toContain("Ressenti");
    expect(metricRow).toContain("Humidité");
    expect(metricRow).toContain("Vent");
    expect(metricRow).toContain("15°C");
    expect(metricRow).toContain("68 %");
    expect(metricRow).toContain("12 km/h");
  });

  it("preserves unavailable-weather behavior and translated metrics",()=>{
    const unavailable={...city,current:null,freshness:"UNAVAILABLE" as const};
    const emptyHtml=renderToStaticMarkup(createElement(WeatherCard,{
      city:unavailable,locale:"fr",now:null,
    }));
    expect(emptyHtml).toContain("Météo indisponible");
    expect(emptyHtml).not.toContain("<dl");
    for(const locale of ["en","de","es","it","pt","ru","nl"]){
      const html=renderToStaticMarkup(createElement(WeatherCard,{city,locale,now:null}));
      expect((html.match(/<dt>/g)||[])).toHaveLength(3);
    }
  });
});
