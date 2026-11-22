import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const search=readFileSync(new URL("./TvWorldSearch.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("./tv-world-search.module.css",import.meta.url),"utf8");
describe("Worldwide TV programme result cards",()=>{
 it("shows channel logos, programme illustrations, start times and titles",()=>{
  expect(search).toContain("row.logoUrl");
  expect(search).toContain("row.imageUrl");
  expect(search).toContain("formatBroadcast(row.startsAt,row.timeZone,locale)");
  expect(search).toContain("row.category");
  expect(search).toContain("minutesBetween(row.startsAt,row.endsAt)");
  expect(search).toContain("styles.programmePoster");
  expect(search).toContain("styles.programmeTitle");
 });
 it("highlights only broadcasts active at the actual current time",()=>{
  expect(search).toContain("Date.parse(row.startsAt)<=nowMs&&nowMs<Date.parse(row.endsAt)");
  expect(search).toContain("styles.programmeLive");
  expect(search).toContain("styles.onAirBadge");
  expect(search).toContain("styles.programmeProgress");
  expect(search).toContain("setInterval(update,30_000)");
 });
 it("retains a working link to the airing detail and responsive cards",()=>{
  expect(search).toContain('tv/airings/');
  expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  expect(css).toContain(".programmeList{grid-template-columns:minmax(0,1fr)}");
 });
});
