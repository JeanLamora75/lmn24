import {describe,expect,it,vi} from "vitest";
import {WeatherMonitoringService} from "./weather-monitoring.service";
const now=new Date();
const row={
 id:"1234",trigger:"MANUAL",continentCode:"EU",startedAt:new Date(now.getTime()-10000),
 finishedAt:new Date(),status:"PARTIAL",
 totalCities:15,processedCities:15,successfulCities:14,failedCities:1,
 errorMessage:"Paris : HTTP 503",
};
function mock(){
 const weatherRun={
  findMany:vi.fn(async(args: {take?:number})=>args.take===500?[row]:[row]),
  count:vi.fn(async()=>1),
  findFirst:vi.fn(async()=>null),
  aggregate:vi.fn(async()=>({_sum:{processedCities:15,successfulCities:14,failedCities:1}})),
  groupBy:vi.fn(async()=>[{status:"PARTIAL",_count:{_all:1}}]),
 };
 const weatherCity={count:vi.fn(async()=>15)};
 const weatherCurrent={count:vi.fn(async(args: {where:{observedAt?:unknown}})=>
   args.where.observedAt?12:14)};
 const setting={findFirst:vi.fn(async()=>({value:"180"}))};
 return {db:{prisma:{weatherRun,weatherCity,weatherCurrent,setting}},
   weatherRun,weatherCity,weatherCurrent,setting};
}
describe("SCRUM-77 — weather monitoring statistics",()=>{
 it("shows city unit totals and freshness independently of RSS and videos",async()=>{
  const db=mock();
  const result=await new WeatherMonitoringService(db.db as never).overview({
   period:"24h",status:"ALL",continent:"EU",page:1,pageSize:20
  });
  expect(result.activeCities).toBe(15);
  expect(result.currentPresent).toBe(14);
  expect(result.freshCities).toBe(12);
  expect(result.staleCities).toBe(3);
  expect(result.partial).toBe(1);
  expect(result.executions).toBe(1);
  expect(result.successfulCities).toBe(14);
  expect(result.failedCities).toBe(1);
  expect(result.rows[0]?.status).toBe("PARTIAL");
  expect(result.alerts.map(a=>a.type)).toContain("STALE_WEATHER");
  expect(db.weatherRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
   where:expect.objectContaining({continentCode:"EU"})
  }));
 });
 it("respects status filter and page size without mixing city counts",async()=>{
  const db=mock();
  await new WeatherMonitoringService(db.db as never).overview({
   period:"7d",status:"ERROR",continent:"ALL",page:2,pageSize:50
  });
  expect(db.weatherRun.count).toHaveBeenCalledWith({
   where:expect.objectContaining({status:"ERROR"})
  });
  expect(db.weatherRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
   take:50,skip:50
  }));
  expect(db.weatherCity.count).toHaveBeenCalledWith({where:{isActive:true}});
 });
});
