import {describe,expect,it} from "vitest";
import {
 addLocalDays,assertTvDay,coversWindow,gapsInDay,isWithinStartWindow,
 stateForChannel,todayInZone,tvWindow,type TvAiring,type CoverageEvidence,
} from "./tv-public-policy";
import {localDayBounds} from "./tv-import-time";

const day="2026-11-21",zone="Europe/Paris";
const now=new Date("2026-11-21T09:00:00Z");
function airing(id:string,start:string,end:string,variantId="v"):TvAiring{
 return {id,variantId,sourceId:"licensed",startsAt:start,endsAt:end,
 title:"Real fixture",category:null,description:null,imageUrl:null};
}
describe("SCRUM-118 TV public date and window contracts",()=>{
 it("selects J0..J+6 by reference timezone and rejects J-1 and J+7",()=>{
  expect(todayInZone(now,zone)).toBe(day);
  expect(addLocalDays(day,6)).toBe("2026-11-27");
  expect(assertTvDay("2026-11-27",zone,now)).toBe("2026-11-27");
  expect(()=>assertTvDay("2026-11-28",zone,now)).toThrow(/TV_DATE_OUTSIDE/);
  expect(()=>assertTvDay("2026-11-20",zone,now)).toThrow();
 });
 it("includes exact 20:30 and 21:30, not 21:30:00.001; same for late",()=>{
  for(const value of ["2026-11-21T19:30:00.000Z","2026-11-21T20:30:00.000Z"])
    expect(isWithinStartWindow(value,zone,day,"TONIGHT")).toBe(true);
  expect(isWithinStartWindow("2026-11-21T20:30:00.001Z",zone,day,"TONIGHT")).toBe(false);
  expect(isWithinStartWindow("2026-11-21T19:29:59.999Z",zone,day,"TONIGHT")).toBe(false);
  expect(isWithinStartWindow("2026-11-21T21:30:00.000Z",zone,day,"LATE")).toBe(true);
  expect(isWithinStartWindow("2026-11-21T22:30:00.000Z",zone,day,"LATE")).toBe(true);
  expect(isWithinStartWindow("2026-11-21T22:30:00.001Z",zone,day,"LATE")).toBe(false);
 });
 it("selects the first programme longer than 30 minutes starting 20:30–21:30",()=>{
  const short=airing("short","2026-11-21T19:30:00Z","2026-11-21T19:40:00Z");
  const exactlyThirty=airing("thirty","2026-11-21T19:40:00Z","2026-11-21T20:10:00Z");
  const long=airing("long","2026-11-21T20:10:00Z","2026-11-21T21:00:00Z");
  const later=airing("later","2026-11-21T20:20:00Z","2026-11-21T22:00:00Z");
  const choose=(items:TvAiring[])=>stateForChannel({
    tab:"TONIGHT",localDate:day,timezone:zone,variantId:"v",
    airings:items,coverage:[],now,
  });
  expect(choose([later,short,exactlyThirty,long]).airing).toEqual(long);
  expect(choose([exactlyThirty,short]).airing).toEqual(short);
  expect(choose([exactlyThirty]).airing).toEqual(exactlyThirty);
  // An already-running programme is used only if nothing starts in the window.
  const earlier=airing("early","2026-11-21T19:00:00Z","2026-11-21T21:00:00Z");
  const tooLate=airing("late","2026-11-21T20:31:00Z","2026-11-21T22:00:00Z");
  expect(choose([earlier,short,tooLate]).airing).toEqual(short);
  expect(choose([earlier,tooLate]).airing).toEqual(earlier);
  const boundary=airing("boundary","2026-11-21T20:30:00Z","2026-11-21T21:31:00Z");
  expect(choose([boundary]).airing).toEqual(boundary);
 });
 it("NOW is half-open and uses a real UTC instant only",()=>{
  const a=airing("n","2026-11-21T08:30:00Z","2026-11-21T09:00:00Z");
  expect(stateForChannel({tab:"NOW",localDate:day,timezone:zone,variantId:"v",
    airings:[a],coverage:[],now}).programmeState).toBe("EPG_UNAVAILABLE");
  expect(stateForChannel({tab:"NOW",localDate:day,timezone:zone,variantId:"v",
    airings:[a],coverage:[],now:new Date("2026-11-21T08:59:59Z")}).programmeState)
    .toBe("AVAILABLE");
 });
 it("refuses NO_START when coverage is missing or not independently verified",()=>{
  const window=tvWindow("TONIGHT",day,zone,now);
  const evidence:CoverageEvidence[]=[{variantId:"v",sourceId:"s",startMs:window.startMs,
    endMs:window.endMs,approvedAt:now.toISOString(),verified:false}];
  expect(coversWindow(evidence,"v",window.startMs,window.endMs,now)).toBe(false);
  expect(stateForChannel({tab:"TONIGHT",localDate:day,timezone:zone,variantId:"v",
    airings:[],coverage:evidence,now}).programmeState).toBe("EPG_UNAVAILABLE");
  evidence[0]!.verified=true;
  expect(stateForChannel({tab:"TONIGHT",localDate:day,timezone:zone,variantId:"v",
    airings:[],coverage:evidence,now}).programmeState).toBe("NO_START_IN_WINDOW");
  evidence[0]!.endMs-=1;
  expect(stateForChannel({tab:"TONIGHT",localDate:day,timezone:zone,variantId:"v",
    airings:[],coverage:evidence,now}).programmeState).toBe("EPG_UNAVAILABLE");
 });
 it("preserves cross-midnight original timestamps and derives honest gaps",()=>{
  const {startMs,endMs}=localDayBounds("2026-03-29",zone);
  const span=airing("night",new Date(startMs-3600_000).toISOString(),
    new Date(startMs+3600_000).toISOString());
  const result=stateForChannel({tab:"CHANNELS",localDate:"2026-03-29",timezone:zone,
    variantId:"v",airings:[span],coverage:[],now:new Date(startMs)});
  expect(result.airing?.startsAt).toBe(span.startsAt);
  const gaps=gapsInDay([span],"2026-03-29",zone);
  expect(gaps).toEqual([{startsAt:new Date(startMs+3600_000).toISOString(),
    endsAt:new Date(endMs).toISOString(),reason:"EPG_UNAVAILABLE"}]);
  expect((endMs-startMs)/3600_000).toBe(23);
  expect(localDayBounds("2026-10-25",zone).hours).toBe(25);
 });
});
