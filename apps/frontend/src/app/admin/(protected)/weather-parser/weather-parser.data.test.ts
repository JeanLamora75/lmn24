import {describe,expect,it} from "vitest";
import {WEATHER_CONTINENTS,weatherElapsed,weatherProgress,weatherTargetCount,type WeatherRun} from "./weather-parser.data";

const initial:WeatherRun={
  id:"abc",trigger:"MANUAL",continentCode:"EU",startedAt:"2026-10-16T10:00:00Z",
  finishedAt:"2026-10-16T10:00:20Z",status:"SUCCESS",
  totalCities:15,processedCities:15,successfulCities:15,failedCities:0,errorMessage:null,
};

describe("SCRUM-72 — météo administration",()=>{
  it("counts only active cities and respects selected continent",()=>{
    const cities=[
      {id:"1",name:"Paris",continentCode:"EU" as const,isActive:true},
      {id:"2",name:"London",continentCode:"EU" as const,isActive:false},
      {id:"3",name:"Tokyo",continentCode:"AS" as const,isActive:true},
    ];
    expect(weatherTargetCount(cities,"all")).toBe(2);
    expect(weatherTargetCount(cities,"EU")).toBe(1);
    expect(weatherTargetCount(cities,"AF")).toBe(0);
    expect(WEATHER_CONTINENTS.OC).toBe("Océanie");
  });
  it("calculates true progress including partial and empty runs",()=>{
    expect(weatherProgress(initial)).toBe(100);
    expect(weatherProgress({...initial,status:"RUNNING",processedCities:7})).toBe(47);
    expect(weatherProgress({...initial,totalCities:0,processedCities:0,status:"RUNNING"})).toBe(0);
    expect(weatherProgress({...initial,totalCities:0,processedCities:0})).toBe(100);
    expect(weatherProgress({...initial,processedCities:100})).toBe(100);
  });
  it("shows durable finished duration",()=>{
    expect(weatherElapsed(initial)).toBe("20 s");
  });
});
