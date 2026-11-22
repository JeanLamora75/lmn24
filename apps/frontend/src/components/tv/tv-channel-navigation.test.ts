import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const guide=readFileSync(new URL("./TvGuideHome.tsx",import.meta.url),"utf8");
const channel=readFileSync(new URL("./TvChannelDetails.tsx",import.meta.url),"utf8");
describe("TV Guide: Channels tab and channel day",()=>{
 it("displays only channel logo tiles in the Channels tab",()=>{
  expect(guide).toContain('tab==="CHANNELS"');
  expect(guide).toContain("styles.logoGrid");
  expect(guide).toContain("<TvChannelLogo");
  expect(guide).toContain("styles.logoTile");
  expect(guide).toContain('alt={item.channel.name}');
 });
 it("opens the selected day when selecting a logo",()=>{
  expect(guide).toContain("date=\${encodeURIComponent(date)}");
  expect(channel).toContain("offsetForDay(new Date(),selected.timeZone,initialDate)");
  expect(channel).toContain("/api/public/tv/channels/");
 });
 it("marks only the real currently airing programme",()=>{
  expect(channel).toContain("Date.parse(event.airing.startsAt)<=nowMs");
  expect(channel).toContain("nowMs<Date.parse(event.airing.endsAt)");
  expect(channel).toContain('date===dayAtOffset(new Date(nowMs),variant.timeZone,0)');
  expect(channel).toContain('aria-current={isCurrent?"time":undefined}');
  expect(channel).toContain("styles.currentEvent");
 });
});
