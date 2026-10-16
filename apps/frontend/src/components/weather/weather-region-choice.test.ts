import { describe, expect, it } from "vitest";
import {
  WEATHER_CONTINENT_COOKIE,
  WEATHER_COOKIE_MAX_AGE,
  resolveWeatherSelection,
} from "./weather-region-choice";

describe("SCRUM-75 — automatic weather continent & manual preference",()=>{
  it("defaults to Europe when proxy location is absent or not trusted",()=>{
    expect(resolveWeatherSelection({
      preference:null,cloudflareContinent:null,geoipProvider:undefined,
    })).toEqual({continent:"EU",mode:"automatic",source:"fallback"});
    expect(resolveWeatherSelection({
      preference:null,cloudflareContinent:"AS",geoipProvider:undefined,
    })).toEqual({continent:"EU",mode:"automatic",source:"fallback"});
    expect(resolveWeatherSelection({
      preference:null,cloudflareContinent:"AS",geoipProvider:"untrusted",
    }).continent).toBe("EU");
  });

  it.each(["EU","AS","AF","NA","SA","OC"] as const)(
    "accepts trusted Cloudflare continent %s without a manual choice", (continent)=>{
      expect(resolveWeatherSelection({
        preference:null,cloudflareContinent:continent,geoipProvider:"cloudflare",
      })).toEqual({continent,mode:"automatic",source:"geoip"});
    }
  );

  it("keeps a manual preference even when language and IP region disagree",()=>{
    expect(resolveWeatherSelection({
      preference:"SA",cloudflareContinent:"AS",geoipProvider:"cloudflare",
    })).toEqual({continent:"SA",mode:"manual",source:"preference"});
    expect(resolveWeatherSelection({
      preference:"OC",cloudflareContinent:null,geoipProvider:undefined,
    })).toEqual({continent:"OC",mode:"manual",source:"preference"});
  });

  it("rejects invalid cookie choices and Cloudflare reserved/unknown regions",()=>{
    for(const preference of ["XX","AN","T1","zz","eu","AS,EU","", "EU; Path=/"]){
      expect(resolveWeatherSelection({
        preference,cloudflareContinent:"NA",geoipProvider:"cloudflare",
      }).continent).toBe("NA");
    }
    for(const header of ["XX","AN","T1","Europe","eu","SA,EU","  SA  ",""]){
      expect(resolveWeatherSelection({
        preference:null,cloudflareContinent:header,geoipProvider:"cloudflare",
      })).toEqual({continent:"EU",mode:"automatic",source:"fallback"});
    }
  });

  it("uses a first-party scoped cookie only for an explicit manual choice",()=>{
    expect(WEATHER_CONTINENT_COOKIE).toBe("lmn24_weather_continent");
    expect(WEATHER_COOKIE_MAX_AGE).toBe(365*24*60*60);
  });
});
