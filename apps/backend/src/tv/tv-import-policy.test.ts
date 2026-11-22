import { describe,expect,it } from "vitest";
import {
 assertImportDays,chooseImportCountries,chooseSources,deriveRunStatus,
 failedScopeIds,mergeAirings,type AiringCandidate,
} from "./tv-import-policy";

const countries=[{id:"FR",isActive:true},{id:"US",isActive:false},{id:"DE",isActive:true}];
const start=Date.parse("2026-11-21T00:00:00Z"), hour=3600_000;
const event=(sourceId:string,priority:number,at:number,length=1):AiringCandidate=>({
 sourceId,priority,variantId:"v",programmeId:"p",externalId:sourceId+at,
 fingerprint:sourceId+at,startsAt:new Date(start+at*hour).toISOString(),
 endsAt:new Date(start+(at+length)*hour).toISOString(),
});
describe("SCRUM-117 EPG import safety",()=>{
 it("targets only active countries automatically, including manual disabled target",()=>{
  expect(chooseImportCountries(countries,"AUTOMATIC").map(x=>x.id)).toEqual(["DE","FR"]);
  expect(chooseImportCountries(countries,"AUTOMATIC","US")).toEqual([]);
  expect(chooseImportCountries(countries,"MANUAL","US").map(x=>x.id)).toEqual(["US"]);
  expect(()=>chooseImportCountries(countries,"MANUAL","unknown")).toThrow();
  expect(assertImportDays(7)).toBe(7);
  for(const value of [0,8,1.1,NaN])expect(()=>assertImportDays(value)).toThrow();
 });
 it("ignores unlicensed or disabled sources and orders ties by ID",()=>{
  const base={countryId:"FR",sourceActive:true,countrySourceActive:true,
    priority:2,programmesApproved:true,rightsEvidence:true};
  const sources=[{...base,id:"b"},{...base,id:"a"},
   {...base,id:"c",priority:1,programmesApproved:false},
   {...base,id:"d",countrySourceActive:false}];
  expect(chooseSources(sources,"FR").map(x=>x.id)).toEqual(["a","b"]);
  expect(chooseSources([...sources,{...base,id:"e",rightsEvidence:false}],"FR").map(x=>x.id))
    .toEqual(["a","b","e"]);
 });
 it("keeps the highest-priority full airing, fills genuine gaps without clipping",()=>{
  const input=[event("secondary",2,0,2),event("primary",1,1,2),
    event("secondary",2,3,1),event("secondary",2,4,1)];
  const merged=mergeAirings(input,[{startMs:start,endMs:start+5*hour,sourceId:"primary",confirmed:true}],
    start,start+5*hour);
  expect(merged.airings.map(x=>x.fingerprint)).toEqual(["primary1","secondary3","secondary4"]);
  expect(merged.rejected.some(x=>x.reason==="OVERLAP")).toBe(true);
 });
 it("rejects bad intervals, duplicate emissions and missing coverage",()=>{
  const x=event("primary",1,0);
  const duplicate={...x,fingerprint:"other"};
  const result=mergeAirings([x,duplicate,{...event("broken",1,1),endsAt:"bad"}],[],
    start,start+2*hour);
  expect(result.airings).toHaveLength(1);
  expect(result.rejected.map(x=>x.reason)).toContain("DUPLICATE");
  expect(result.rejected.map(x=>x.reason)).toContain("INVALID_INTERVAL");
  expect(result.canReplaceExisting).toBe(false);
 });
 it("never replaces published grid on unknown or partial coverage",()=>{
  const a=mergeAirings([],[],start,start+hour);
  const b=mergeAirings([],[{startMs:start,endMs:start+hour/2,sourceId:"primary",confirmed:true}],start,start+hour);
  expect(a.canReplaceExisting).toBe(false);
  expect(b.canReplaceExisting).toBe(false);
  expect(mergeAirings([],[{startMs:start,endMs:start+hour,sourceId:"primary",confirmed:true}],
    start,start+hour).canReplaceExisting).toBe(true);
 });
 it("preserves completed scopes when one country fails and retries only failures",()=>{
  expect(deriveRunStatus(["SUCCESS","ERROR"])).toBe("PARTIAL");
  expect(deriveRunStatus(["ERROR","ERROR"])).toBe("ERROR");
  expect(deriveRunStatus(["SUCCESS","SUCCESS"])).toBe("SUCCESS");
  expect(failedScopeIds([{id:"a",status:"SUCCESS"},{id:"b",status:"ERROR"},
    {id:"c",status:"INTERRUPTED"}])).toEqual(["b","c"]);
 });
});
