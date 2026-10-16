import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {GET} from "./route";

vi.mock("../../../../lib/admin-backend", () => ({
  getBackendUrl: () => "http://backend.test:3001",
}));

const weather=(continent="EU")=>({
  continent,generatedAt:"2026-10-16T12:00:00.000Z",staleAfterMinutes:180,
  attribution:{name:"Open-Meteo",url:"https://open-meteo.com/"},
  count:1,items:[{
    slug:"paris",name:"Paris",countryIso2:"FR",continentCode:continent,
    timezone:"Europe/Paris",displayOrder:1,freshness:"FRESH",
    current:{temperatureC:18,apparentTemperatureC:17,humidityPct:65,
      windSpeedKmh:6,weatherCode:1,isDay:true,
      observedAt:"2026-10-16T12:00:00.000Z",fetchedAt:"2026-10-16T12:01:00.000Z",
      provider:"OPEN_METEO"},
  }],
});
const input=(q:string,init?:RequestInit)=>
  new Request("http://localhost:3000/api/public/weather"+q,init);
const respond=(body:unknown,status=200)=>
  new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

describe("SCRUM-79 — public weather proxy contract and security",()=>{
  beforeEach(()=>vi.stubGlobal("fetch",vi.fn(async()=>respond(weather()))));
  afterEach(()=>vi.unstubAllGlobals());

  it("serves validated weather from NestJS without sending visitor cookies or calling provider",async()=>{
    const result=await GET(input("?continent=EU",{
      headers:{cookie:"lmn24_session=secret; sensitive=yes",authorization:"Bearer private"}
    }));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toContain("max-age=30");
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await result.json()).toMatchObject({continent:"EU",count:1});
    const fetchMock=vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://backend.test:3001/weather?continent=EU");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({cache:"no-store"}));
    const requestInit=fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.headers).toBeUndefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("open-meteo.com");
  });

  it.each([
    "?continent=eu","?continent=XX","?continent=NA&continent=EU",
    "?continent=EU&debug=true","?continent=EU%20","?continent=",
  ])("rejects invalid geography before any backend call: %s",async q=>{
    const response=await GET(input(q));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("defaults to Europe when no region is supplied",async()=>{
    const result=await GET(input(""));
    expect(result.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "http://backend.test:3001/weather?continent=EU");
  });

  it.each([
    ["upstream error",()=>respond({message:"Internal Prisma connection secrets"},500)],
    ["malformed JSON",()=>new Response("{invalid",{status:200})],
    ["wrong continent",()=>respond(weather("OC"))],
    ["invalid city count",()=>respond({...weather(),count:666})],
    ["too many cities",()=>respond({...weather(),
      count:151,items:Array.from({length:151},()=>weather().items[0])})],
    ["oversized payload",()=>new Response("x".repeat(130_000),{status:200})],
  ])("fails closed for %s",async (_case,response)=>{
    vi.stubGlobal("fetch",vi.fn(async()=>response()));
    const result=await GET(input("?continent=EU"));
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const body=await result.text();
    expect(body).not.toContain("Prisma");
    expect(body).not.toContain("Internal");
  });

  it("handles network failure as a non-cacheable service outage",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("Connection secret internal");}));
    const result=await GET(input("?continent=EU"));
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({message:"Weather service unavailable."});
  });
});
