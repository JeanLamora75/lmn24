import {describe,expect,it} from "vitest";
import {DETAIL_COPY,approvedExternalUrl,dayAtOffset,durationMinutes,gapItems,
 localDateLabel,offsetForDay,selectVariant,timeLabel,validTvId,type TvGap,
 type TvVariant} from "./tv-detail-model";
import type {TvAiring} from "./tv-guide-model";
const vars:TvVariant[]=[
 {id:"a1111111-1111-4111-8111-111111111111",code:"east",name:"East",timeZone:"America/New_York"},
 {id:"a2222222-2222-4222-8222-222222222222",code:"west",name:"West",timeZone:"America/Los_Angeles"},
];
describe("SCRUM-120 UX02 invariants",()=>{
 it("selects explicitly requested and country-default variants, deterministic fallback",()=>{
  expect(selectVariant(vars,vars[1]!.id,vars[0]!.id)?.id).toBe(vars[1]!.id);
  expect(selectVariant(vars,"unknown",vars[0]!.id)?.id).toBe(vars[0]!.id);
  expect(selectVariant(vars,null,null)?.id).toBe(vars[0]!.id);
  expect(selectVariant([],null,null)).toBeNull();
 });
 it("retains J+offset when variant changes and computes days with IANA",()=>{
  const now=new Date("2026-11-21T02:30:00Z");
  expect(dayAtOffset(now,"Europe/Paris",2)).toBe("2026-11-23");
  expect(dayAtOffset(now,"America/New_York",2)).toBe("2026-11-22");
  expect(offsetForDay(now,"Europe/Paris","2026-11-23")).toBe(2);
  expect(offsetForDay(now,"Europe/Paris","2026-12-02")).toBeNull();
 });
 it("does not lose UTC identity on DST and distinguishes double 01:30",()=>{
  const a=timeLabel("2026-11-01T05:30:00Z","America/New_York","en");
  const b=timeLabel("2026-11-01T06:30:00Z","America/New_York","en");
  expect(a).not.toEqual(b);
  expect(durationMinutes("2026-11-01T05:30:00Z","2026-11-01T06:30:00Z")).toBe(60);
  expect(localDateLabel("2026-11-01T01:00:00Z","America/New_York","en"))
    .toContain("Oct");
 });
 it("gaps stay non-airing items, ordered without invented programme ids",()=>{
  const airing:TvAiring={id:"real",variantId:"v",sourceId:"source",startsAt:"2026-11-21T20:00:00Z",
   endsAt:"2026-11-21T21:00:00Z",title:"Actual airing",category:null,
   description:null,imageUrl:null};
  const gaps:TvGap[]=[{startsAt:"2026-11-21T19:00:00Z",
   endsAt:"2026-11-21T20:00:00Z",reason:"EPG_UNAVAILABLE"}];
  const items=gapItems([airing],gaps);
  expect(items.map(x=>x.kind)).toEqual(["gap","airing"]);
  expect(items.filter(x=>x.kind==="airing")).toHaveLength(1);
 });
 it("rejects untrusted external links and invented IDs",()=>{
  expect(validTvId(vars[0]!.id)).toBe(true);
  expect(validTvId("wrong")).toBe(false);
  expect(approvedExternalUrl("javascript:alert(1)")).toBeNull();
  expect(approvedExternalUrl("http://example.org")).toBeNull();
  expect(approvedExternalUrl("https://example.org/")).toBe("https://example.org/");
 });
 it("has localized titles and accessibility copy for all eight locales",()=>{
  expect(Object.keys(DETAIL_COPY).sort()).toEqual(["de","en","es","fr","it","nl","pt","ru"]);
  for(const entry of Object.values(DETAIL_COPY)){
   expect(entry.grid.length).toBeGreaterThan(2);
   expect(entry.programmeGone.length).toBeGreaterThan(10);
  }
 });
});