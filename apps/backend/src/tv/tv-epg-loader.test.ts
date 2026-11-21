import {describe,expect,it,vi} from "vitest";
import {createVerifiedDbEpgLoader,noCoverageAttested} from "./tv-epg-loader";
import type {TvWriterLease} from "./tv-import-publisher";
import type {Coverage} from "./tv-import-policy";

const countryId="a1000000-0000-4000-8000-000000000001";
const sourceId="a2000000-0000-4000-8000-000000000001";
const variantId="a3000000-0000-4000-8000-000000000001";
const fixture=Buffer.from(JSON.stringify({programmes:[{
 channel:"sample.channel",id:"fixture-1",
 start:"2026-11-21T19:30:00Z",end:"2026-11-21T20:30:00Z",
 title:"Fixture",synopsis:"Fixture synopsis",imageUrl:"https://example.org/a.jpg",
}]}));
function setup(){
 const query=vi.fn(async(sql:string,_params?:unknown[])=>{
  void _params;
  if(sql.includes("SELECT requested_days"))return {rows:[{requested_days:7}]};
  if(sql.includes("FROM public.tv_import_scope scope"))return {rows:[
   {scopeId:"s1",sourceId,sourceUrl:"https://example.org/feed.json",format:"JSON",priority:1,
    programmeRightsStatus:"APPROVED",programmeRightsReference:"https://example.org/licence",
    synopsisRightsStatus:"UNREVIEWED",synopsisRightsReference:null,
    imageRightsStatus:"UNREVIEWED",imageRightsReference:null},
   {scopeId:"s2",sourceId:"a2000000-0000-4000-8000-000000000002",
    sourceUrl:"https://example.org/other",format:"JSON",priority:2,
    programmeRightsStatus:"UNREVIEWED",programmeRightsReference:null,
    synopsisRightsStatus:"UNREVIEWED",synopsisRightsReference:null,
    imageRightsStatus:"UNREVIEWED",imageRightsReference:null},
  ]};
  if(sql.includes("FROM public.tv_channel_external_id m"))return {rows:[{variantId,timezone:"Europe/Paris"}]};
  if(sql.includes("FROM public.tv_schedule_current"))return {rows:[]};
  return {rows:[]};
 });
 const lease=({client:{query},ownerToken:"owner",signal:new AbortController().signal,
  release:vi.fn()} as unknown) as TvWriterLease;
 const transport=vi.fn(async()=>fixture);
 return {lease,transport,query};
}
describe("SCRUM-117 licensed in-memory EPG ingestion adapter",()=>{
 it("decodes a source under owner, inspects unlicensed feeds without publishing, never invents coverage",async()=>{
  const {lease,transport,query}=setup();
  const loader=createVerifiedDbEpgLoader(lease,"run",{transport,
   attest:noCoverageAttested,now:new Date("2026-11-21T12:00:00Z")});
  const result=await loader.loadCountry(countryId,["s1","s2"],new AbortController().signal);
  expect(result.scopeResults).toEqual([
   {scopeId:"s1",outcome:"SUCCESS"},{scopeId:"s2",outcome:"SUCCESS",message:"DISCOVERY_ONLY"},
  ]);
  expect(transport).toHaveBeenCalledTimes(2);
  expect(query.mock.calls.some(c=>c[0].includes("INSERT INTO public.tv_channel_external_id"))).toBe(true);
  expect(result.days).toHaveLength(1);
  expect(result.days[0]?.coverage).toEqual([]);
  expect(result.days[0]?.candidates).toHaveLength(1);
  expect(query.mock.calls.some(c=>c[0].includes("INSERT INTO public.tv_programme")
    &&c[1]?.[2]!==null)).toBe(false); // synopsis must be omitted without rights
  expect(query.mock.calls.some(c=>c[0].includes("assert_parser_write_epoch"))).toBe(true);
 });
 it("admin discovery worker records only unknown IDs even when programme rights are APPROVED",async()=>{
  const {lease,transport,query}=setup();
  const attest=vi.fn(async()=>[]);
  const loader=createVerifiedDbEpgLoader(lease,"run",{
   transport,attest,discoveryOnly:true,now:new Date("2026-11-21T12:00:00Z"),
  });
  const loaded=await loader.loadCountry(countryId,["s1","s2"],new AbortController().signal);
  expect(loaded.days).toEqual([]);
  expect(loaded.scopeResults).toEqual([
   {scopeId:"s1",outcome:"SUCCESS",message:"DISCOVERY_ONLY"},
   {scopeId:"s2",outcome:"SUCCESS",message:"DISCOVERY_ONLY"},
  ]);
  expect(query.mock.calls.some(c=>c[0].includes("INSERT INTO public.tv_channel_external_id"))).toBe(true);
  expect(query.mock.calls.some(c=>c[0].includes("INSERT INTO public.tv_programme"))).toBe(false);
  expect(query.mock.calls.some(c=>c[0].includes("FROM public.tv_schedule_current"))).toBe(false);
  expect(attest).not.toHaveBeenCalled();
 });
 it("reuses each global source acquisition across multiple country partitions",async()=>{
  const {lease,transport}=setup();
  const loader=createVerifiedDbEpgLoader(lease,"run",{
   transport,attest:noCoverageAttested,now:new Date("2026-11-21T12:00:00Z"),
  });
  const signal=new AbortController().signal;
  await loader.loadCountry(countryId,["s1","s2"],signal);
  await loader.loadCountry("a1000000-0000-4000-8000-000000000002",["s1","s2"],signal);
  expect(transport).toHaveBeenCalledTimes(2); // one fetch per globally active source, not per country
 });
 it("accepts independently attested IANA coverage without trusting feed metadata",async()=>{
  const {lease,transport}=setup();
  const attest=vi.fn(async(args:{
    countryId:string;sourceId:string;variantId:string;localDate:string;
    startMs:number;endMs:number;
  }):Promise<readonly Coverage[]>=>[{sourceId:args.sourceId,startMs:args.startMs,
      endMs:args.endMs,confirmed:true}]);
  const loader=createVerifiedDbEpgLoader(lease,"run",{
    transport,attest,now:new Date("2026-11-21T12:00:00Z")});
  const loaded=await loader.loadCountry(countryId,["s1","s2"],new AbortController().signal);
  expect(loaded.days[0]?.coverage).toHaveLength(1);
  expect(attest).toHaveBeenCalledOnce();
 });
 it("fails closed on inaccessible source without generating a published day",async()=>{
  const {lease}=setup();
  const transport=vi.fn(async()=>{throw new Error("Upstream failure");});
  const loader=createVerifiedDbEpgLoader(lease,"run",{
    transport,attest:noCoverageAttested,now:new Date("2026-11-21T12:00:00Z")});
  const loaded=await loader.loadCountry(countryId,["s1","s2"],new AbortController().signal);
  expect(loaded.days).toEqual([]);
  expect(loaded.scopeResults.every(s=>s.outcome==="ERROR")).toBe(true);
 });
});