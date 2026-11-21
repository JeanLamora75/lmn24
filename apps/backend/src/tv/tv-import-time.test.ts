import {describe,expect,it} from "vitest";
import {localDayBounds,assertLocalDate} from "./tv-import-time";
import {mergeAirings,type AiringCandidate} from "./tv-import-policy";
describe("SCRUM-117 IANA calendar boundaries",()=>{
 it("distinguishes normal 24h, spring 23h and autumn 25h Paris days",()=>{
  expect(localDayBounds("2026-03-29","Europe/Paris")).toMatchObject({hours:23});
  expect(localDayBounds("2026-10-25","Europe/Paris")).toMatchObject({hours:25});
  expect(localDayBounds("2026-11-21","Europe/Paris")).toMatchObject({hours:24});
  expect(new Date(localDayBounds("2026-03-29","Europe/Paris").startMs).toISOString()).toBe("2026-03-28T23:00:00.000Z");
  expect(new Date(localDayBounds("2026-03-29","Europe/Paris").endMs).toISOString()).toBe("2026-03-29T22:00:00.000Z");
 });
 it("handles United States DST independently and rejects bad calendar dates",()=>{
  expect(localDayBounds("2026-03-08","America/New_York").hours).toBe(23);
  expect(localDayBounds("2026-11-01","America/New_York").hours).toBe(25);
  expect(localDayBounds("2026-11-21","UTC").hours).toBe(24);
  expect(()=>assertLocalDate("2026-02-30")).toThrow();
  expect(()=>localDayBounds("2026-11-21","Bad/Timezone")).toThrow();
 });
 it("retains cross-midnight airing unchanged, including verified coverage extending across midnight",()=>{
  const day=localDayBounds("2026-03-29","Europe/Paris");
  const item:AiringCandidate={sourceId:"s",programmeId:"p",externalId:"e",variantId:"v",priority:1,
   fingerprint:"fp",startsAt:new Date(day.startMs-20*60_000).toISOString(),
   endsAt:new Date(day.startMs+40*60_000).toISOString()};
  const result=mergeAirings([item],[{sourceId:"s",startMs:day.startMs-5000,endMs:day.endMs+5000,confirmed:true}],
    day.startMs,day.endMs);
  expect(result.canReplaceExisting).toBe(true);
  expect(result.airings).toHaveLength(1);
  expect(result.airings[0]?.startsAt).toBe(item.startsAt);
  expect(result.airings[0]?.endsAt).toBe(item.endsAt);
 });
});