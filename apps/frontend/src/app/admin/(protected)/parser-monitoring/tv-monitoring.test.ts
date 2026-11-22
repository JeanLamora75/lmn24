import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const scheduler=readFileSync(new URL("../scheduler/SchedulerSettings.tsx",import.meta.url),"utf8");
const monitoring=readFileSync(new URL("./ParserMonitoringScreen.tsx",import.meta.url),"utf8");
const panel=readFileSync(new URL("./TvMonitoringPanel.tsx",import.meta.url),"utf8");

describe("Guide TV integrates into existing parser administration",()=>{
 it("shows the real EPG scheduler state without creating an independent scheduler",()=>{
  expect(scheduler).toContain("Guide TV — Import EPG");
  expect(scheduler).toContain("tvGuide.enabled");
  expect(scheduler).toContain('href="/admin/tv/imports"');
  expect(scheduler).toContain("Configuration gérée sur le serveur LMN24");
 });
 it("adds TV selection and its own monitoring panel without polluting Infos/Videos",()=>{
  expect(monitoring).toContain('<option value="TV">Guide TV</option>');
  expect(monitoring).toContain('<TvMonitoringPanel');
  expect(monitoring).toContain('parser==="ALL"||parser==="TV"');
  expect(monitoring).toContain('parser!=="WEATHER"&&parser!=="TV"');
 });
 it("reads existing authenticated EPG history and events rather than making fake data",()=>{
  expect(panel).toContain("/api/admin/tv/import-runs?page=1&pageSize=100");
  expect(panel).toContain('"/events"');
  expect(panel).toContain("AUTOMATIC");
  expect(panel).toContain("historique plus ancien non inclus");
  expect(panel).toContain('href="/admin/tv/imports"');
 });
});
