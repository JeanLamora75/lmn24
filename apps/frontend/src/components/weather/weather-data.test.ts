import {describe,expect,it} from "vitest";
import {WEATHER_REGIONS,weatherCondition,weatherCopy} from "./weather-copy";
import {parseWeatherResponse} from "./weather-data";

function response(region:"EU"|"AS"="EU"){
  return {
    continent:region,
    generatedAt:"2026-10-16T08:00:00.000Z",
    staleAfterMinutes:180,
    attribution:{name:"Open-Meteo",url:"https://open-meteo.com/"},
    count:2,
    items:[
      {slug:"paris",name:"Paris",countryIso2:"FR",continentCode:region,
       timezone:"Europe/Paris",displayOrder:1,freshness:"FRESH",current:{
         temperatureC:18.5,apparentTemperatureC:17,humidityPct:75,
         windSpeedKmh:6,weatherCode:2,isDay:true,
         observedAt:"2026-10-16T08:00:00.000Z",fetchedAt:"2026-10-16T08:01:00.000Z",
         provider:"OPEN_METEO"
       }},
      {slug:"berlin",name:"Berlin",countryIso2:"DE",continentCode:region,
       timezone:"Europe/Berlin",displayOrder:2,freshness:"UNAVAILABLE",current:null}
    ]
  };
}
describe("SCRUM-74 — worldwide weather public page",()=>{
  it("has six continents, eight locales and localized city counters",()=>{
    expect(WEATHER_REGIONS).toEqual(["EU","AS","AF","NA","SA","OC"]);
    for(const locale of ["fr","en","de","es","pt","it","ru","nl"]){
      const text=weatherCopy(locale);
      expect(text.title.length).toBeGreaterThan(3);
      expect(text.choose.length).toBeGreaterThan(3);
      expect(text.cities.length).toBeGreaterThan(2);
      expect(text.modeManual.length).toBeGreaterThan(3);
      expect(text.modeAutomatic.length).toBeGreaterThan(3);
      expect(text.autoDetected.length).toBeGreaterThan(3);
      expect(text.autoFallback.length).toBeGreaterThan(3);
      expect(text.resetAutomatic.length).toBeGreaterThan(3);
      expect(Object.keys(text.regions)).toEqual(WEATHER_REGIONS);
      expect(text.conditions.unknown.length).toBeGreaterThan(2);
    }
    expect(weatherCopy("unknown").title).toBe(weatherCopy("fr").title);
  });
  it("maps WMO weather descriptions without asserting nonexistent observations",()=>{
    expect(weatherCondition(0)).toBe("clear");
    expect(weatherCondition(2)).toBe("partlyCloudy");
    expect(weatherCondition(3)).toBe("overcast");
    expect(weatherCondition(45)).toBe("fog");
    expect(weatherCondition(51)).toBe("drizzle");
    expect(weatherCondition(65)).toBe("rain");
    expect(weatherCondition(73)).toBe("snow");
    expect(weatherCondition(81)).toBe("showers");
    expect(weatherCondition(99)).toBe("storm");
    expect(weatherCondition(500)).toBe("unknown");
  });
  it("validates a continent response including missing data",()=>{
    const result=parseWeatherResponse(response(),"EU");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.freshness).toBe("FRESH");
    expect(result.items[1]?.current).toBeNull();
  });
  it("rejects mismatched continent, malformed or untrusted responses",()=>{
    expect(()=>parseWeatherResponse(response(),"AS")).toThrow();
    expect(()=>parseWeatherResponse({...response(),items:[{
      ...response().items[0],continentCode:"AS"
    }]},"EU")).toThrow();
    expect(()=>parseWeatherResponse({...response(),items:null},"EU")).toThrow();
    expect(()=>parseWeatherResponse({...response(),attribution:{
      name:"Fake weather",url:"https://elsewhere.invalid/"
    }},"EU")).toThrow();
  });
});
