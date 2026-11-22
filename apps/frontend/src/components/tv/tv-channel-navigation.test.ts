import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const guide=readFileSync(new URL("./TvGuideHome.tsx",import.meta.url),"utf8");
const channel=readFileSync(new URL("./TvChannelDetails.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("./tv-guide.module.css",import.meta.url),"utf8");
describe("TV Guide: Channels tab and channel day",()=>{
 it("displays only channel logo tiles in the Channels tab",()=>{
  expect(guide).toContain('tab==="CHANNELS"');
  expect(guide).toContain("styles.logoGrid");
  expect(guide).toContain("<TvChannelLogo");
  expect(guide).toContain("styles.logoTile");
  expect(guide).toContain('alt={item.channel.name}');
 });
 it("shows five larger channel logos per row with number and name underneath",()=>{
  expect(css).toContain("grid-template-columns:repeat(5,minmax(0,1fr))");
  expect(css).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
  expect(css).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  expect(css).toContain("styles.logoTileCaption");
  expect(guide).toContain("item.channel.number>0?");
  expect(guide).toContain("item.channel.name");
 });
 it("opens the selected day when selecting a logo",()=>{
  expect(guide).toContain("date=\${encodeURIComponent(date)}");
  expect(channel).toContain("offsetForDay(new Date(),initial.referenceTimeZone??selected.timeZone,initialDate)");
  expect(channel).toContain("/api/public/tv/channels/");
 });
 it("renders the same complete programme card as the Guide TV and keeps national times",()=>{
  expect(channel).toContain('import {TvCard} from "./TvGuideHome"');
  expect(channel).toContain("<TvCard");
  expect(channel).toContain("countryTimeZone={nationalZone}");
  expect(channel).toContain("nowMs={nowMs}");
 });

});
