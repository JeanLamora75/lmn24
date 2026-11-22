import {describe,expect,it} from "vitest";
import {isWithinStartWindow,localClock,stateForChannel,tvWindow} from "./tv-public-policy";

describe("Guide TV broadcast windows remain correct and fast",()=>{
 it("reuses the same Paris evening window for all channels on the same day",()=>{
  const first=tvWindow("LATE","2026-11-22","Europe/Paris",new Date("2026-11-22T12:00:00Z"));
  const again=tvWindow("LATE","2026-11-22","Europe/Paris",new Date("2026-11-22T16:00:00Z"));
  expect(again).toBe(first);
  expect(first.startMs).toBe(Date.parse("2026-11-22T21:30:00Z"));
  expect(first.endMs).toBe(Date.parse("2026-11-22T22:31:00Z"));
 });
 it("keeps correct UTC shifts on both French DST transition days",()=>{
  const spring=tvWindow("TONIGHT","2026-03-29","Europe/Paris",new Date("2026-03-29T12:00:00Z"));
  const autumn=tvWindow("TONIGHT","2026-10-25","Europe/Paris",new Date("2026-10-25T12:00:00Z"));
  expect(spring.startMs).toBe(Date.parse("2026-03-29T18:30:00Z"));
  expect(autumn.startMs).toBe(Date.parse("2026-10-25T19:30:00Z"));
  expect(localClock(spring.startMs,"Europe/Paris")).toMatchObject({hour:20,minute:30});
 });
 it("preserves late-night priority for a real start over a prior ongoing programme",()=>{
  const now=new Date("2026-11-22T12:00:00Z");
  const records=[
   {id:"prime",variantId:"v",sourceId:"s",startsAt:"2026-11-22T20:10:00Z",endsAt:"2026-11-22T22:55:00Z",title:"Prime",category:null,description:null,imageUrl:null},
   {id:"late",variantId:"v",sourceId:"s",startsAt:"2026-11-22T21:45:00Z",endsAt:"2026-11-22T23:15:00Z",title:"Late",category:null,description:null,imageUrl:null},
  ];
  expect(isWithinStartWindow(records[1]!.startsAt,"Europe/Paris","2026-11-22","LATE")).toBe(true);
  expect(stateForChannel({tab:"LATE",localDate:"2026-11-22",timezone:"Europe/Paris",variantId:"v",airings:records,coverage:[],now}).airing?.id).toBe("late");
 });
 it("retains the current-time window without caching it between calls",()=>{
  const a=tvWindow("NOW","2026-11-22","Europe/Paris",new Date("2026-11-22T12:00:00Z"));
  const b=tvWindow("NOW","2026-11-22","Europe/Paris",new Date("2026-11-22T12:01:00Z"));
  expect(b.startMs-a.startMs).toBe(60000);
 });
});
