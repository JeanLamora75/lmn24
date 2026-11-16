import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const city = {
  provider:"open-meteo-geocoding",providerId:"1850147",name:"Tokyo",
  region:"Tokyo",countryIso2:"JP",continent:"AS",latitude:35.68,longitude:139.69,
  timezone:"Asia/Tokyo",
};
const request = (value: unknown) => new Request("http://localhost:3000/api/public/visitor-weather",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value),
});
afterEach(()=>vi.unstubAllGlobals());

describe("SCRUM-108 — visitor's weather API",()=>{
  it("rejects invalid coordinates, unknown provider and user profile fields",async()=>{
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    expect((await POST(request({...city,latitude:100}))).status).toBe(400);
    expect((await POST(request({...city,provider:"untrusted"}))).status).toBe(400);
    expect((await POST(request({...city,birthDate:"1992-01-01"}))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns a compatible weather card from exact geographic coordinates",async()=>{
    const fetcher=vi.fn(async (_url:string,_options?:RequestInit)=>new Response(JSON.stringify({
      timezone:"Asia/Tokyo",current:{
        time:1763200000,temperature_2m:18,apparent_temperature:17,
        relative_humidity_2m:67,wind_speed_10m:12,
        weather_code:2,is_day:1,
      },
    }),{status:200}));
    vi.stubGlobal("fetch",fetcher);
    const response=await POST(request(city));
    expect(response.status).toBe(200);
    const payload=await response.json();
    expect(payload.city).toMatchObject({
      slug:"favorite-1850147",name:"Tokyo",countryIso2:"JP",
      continentCode:"AS",freshness:"FRESH",current:{temperatureC:18,provider:"OPEN_METEO"},
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    const upstream=new URL(fetcher.mock.calls[0]?.[0] ?? "");
    expect(upstream.hostname).toBe("api.open-meteo.com");
    expect(upstream.searchParams.get("latitude")).toBe("35.68");
    expect(upstream.searchParams.get("longitude")).toBe("139.69");
    expect(upstream.searchParams.get("timeformat")).toBe("unixtime");
    expect(upstream.searchParams.has("birthDate")).toBe(false);
  });
  it("does not hide provider limits or failures",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:429})));
    expect((await POST(request(city))).status).toBe(429);
    vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("offline")}));
    expect((await POST(request(city))).status).toBe(503);
  });
});
