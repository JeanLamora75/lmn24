import { describe,expect,it,vi } from "vitest";
import { WeatherParserEngine,WeatherRunActiveError } from "./weather-parser-engine.js";
const paris={id:"11111111-1111-4111-8111-111111111111",name:"Paris",latitude:48.86,longitude:2.35};
const tokyo={id:"22222222-2222-4222-8222-222222222222",name:"Tokyo",latitude:35.68,longitude:139.65};
function dbMock(cities=[paris,tokyo],active=0){
 const create=vi.fn(async()=>({}));
 const update=vi.fn(async()=>({}));
 const weatherCity={findMany:vi.fn(async()=>cities)};
 const weatherRun={
  create,count:vi.fn(async()=>active),updateMany:vi.fn(async()=>({count:0})),
  update,findUnique:vi.fn(async()=>null),findMany:vi.fn(async()=>[]),
 };
 const advisory=vi.fn(async()=>[]);
 const execute=vi.fn(async()=>1);
 const transaction=vi.fn(async(fn:(tx:unknown)=>Promise<unknown>)=>
   fn({weatherCity,weatherRun,$queryRaw:advisory}));
 const db={weatherCity,weatherRun,$queryRaw:advisory,$transaction:transaction,$executeRaw:execute};
 return {db,weatherCity,weatherRun,create,update,execute,advisory};
}
function weather(size=2){
 return Array.from({length:size},()=>({utc_offset_seconds:0,current:{
  time:Math.floor(Date.now()/1000),temperature_2m:22,apparent_temperature:21,
  relative_humidity_2m:44,wind_speed_10m:10,weather_code:1,is_day:1,
 }}));
}
describe("SCRUM-71 weather parser engine",()=>{
 it("collects active cities, stores progress, completes and avoids duplicates",async()=>{
  const mock=dbMock();
  const fetchBatch=vi.fn(async()=>weather());
  const engine=new WeatherParserEngine(mock.db as never,fetchBatch);
  const runId=await engine.start();
  expect(runId).toMatch(/^[0-9a-f-]{36}$/);
  expect(mock.weatherCity.findMany).toHaveBeenCalledWith(expect.objectContaining({
   where:{isActive:true}
  }));
  await vi.waitFor(()=>expect(mock.update).toHaveBeenCalledWith(
   expect.objectContaining({where:{id:runId},data:expect.objectContaining({status:"SUCCESS"})})
  ));
  expect(fetchBatch).toHaveBeenCalledTimes(1);
  expect(mock.execute).toHaveBeenCalledTimes(2);
  expect(mock.weatherRun.create).toHaveBeenCalledWith(expect.objectContaining({
   data:expect.objectContaining({totalCities:2,trigger:"MANUAL",status:"RUNNING"})
  }));
 });
 it("supports continent filter and persists partial failures",async()=>{
  const mock=dbMock();
  const sample=weather();
  sample[1]!.current.temperature_2m=3000;
  const engine=new WeatherParserEngine(mock.db as never,async()=>sample);
  await engine.start({continentCode:"AS"},"MANUAL");
  expect(mock.weatherCity.findMany).toHaveBeenCalledWith(expect.objectContaining({
   where:{isActive:true,continentCode:"AS"}
  }));
  await vi.waitFor(()=>expect(mock.update).toHaveBeenCalledWith(
   expect.objectContaining({data:expect.objectContaining({
    status:"PARTIAL",errorMessage:expect.stringContaining("Tokyo")
   })})
  ));
  expect(mock.execute).toHaveBeenCalledTimes(1);
  expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
   data:expect.objectContaining({processedCities:2,failedCities:1,successfulCities:1})
  }));
 });
 it("leaves existing observations untouched on fetch failure and records an ERROR",async()=>{
  const mock=dbMock();
  const engine=new WeatherParserEngine(mock.db as never,async()=>{
   throw new Error("HTTP 503");
  });
  await engine.start();
  await vi.waitFor(()=>expect(mock.update).toHaveBeenCalledWith(
   expect.objectContaining({data:expect.objectContaining({status:"ERROR"})})
  ));
  expect(mock.execute).not.toHaveBeenCalled();
  expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
   data:expect.objectContaining({processedCities:2,failedCities:2,successfulCities:0})
  }));
 });
 it("refuses a concurrent run before any requests",async()=>{
  const mock=dbMock([paris],1);
  const fetchBatch=vi.fn(async()=>weather(1));
  const engine=new WeatherParserEngine(mock.db as never,fetchBatch);
  await expect(engine.start()).rejects.toBeInstanceOf(WeatherRunActiveError);
  expect(mock.weatherRun.create).not.toHaveBeenCalled();
  expect(fetchBatch).not.toHaveBeenCalled();
 });
 it("processes 66 cities in nine bounded batches, with one invalid response isolated",async()=>{
  const cities=Array.from({length:66},(_,i)=>({
    id:"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"),
    name:"City-"+(i+1),latitude:40+i/100,longitude:3+i/100,
  }));
  const mock=dbMock(cities);
  const fetchBatch=vi.fn(async(group:typeof cities)=>{
    const sample=weather(group.length);
    if(group[0]?.name==="City-65"){
      sample[1]!.current.temperature_2m=999;
    }
    return sample;
  });
  const engine=new WeatherParserEngine(mock.db as never,fetchBatch);
  const runId=await engine.start({},"MANUAL");
  await vi.waitFor(()=>expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({where:{id:runId},data:expect.objectContaining({
      status:"PARTIAL",
    })})
  ));
  expect(fetchBatch).toHaveBeenCalledTimes(9);
  expect(fetchBatch.mock.calls.map(([batch])=>batch.length))
    .toEqual([8,8,8,8,8,8,8,8,2]);
  expect(mock.execute).toHaveBeenCalledTimes(65);
  expect(mock.weatherRun.create).toHaveBeenCalledWith(expect.objectContaining({
    data:expect.objectContaining({totalCities:66,status:"RUNNING"})
  }));
  expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
    data:expect.objectContaining({
      processedCities:66,successfulCities:65,failedCities:1,
      errorMessage:expect.stringContaining("City-66"),
    }),
  }));
 });

 it("handles no active cities without making API requests",async()=>{
  const mock=dbMock([]);
  const fetchBatch=vi.fn(async()=>weather());
  const engine=new WeatherParserEngine(mock.db as never,fetchBatch);
  await engine.start();
  await vi.waitFor(()=>expect(mock.update).toHaveBeenCalledWith(
   expect.objectContaining({data:expect.objectContaining({status:"SUCCESS"})})
  ));
  expect(fetchBatch).not.toHaveBeenCalled();
 });
});
