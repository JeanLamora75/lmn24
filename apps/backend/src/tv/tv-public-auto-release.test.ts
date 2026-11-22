import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const service=readFileSync(new URL("./tv-public.service.ts",import.meta.url),"utf8");
describe("Guide TV: automatic availability of imported programmes",()=>{
 it("shows active channels without editorial review or a national number",()=>{
  const channels=service.slice(service.indexOf("private async channelRows("),service.indexOf("private async publishedAirings("));
  expect(channels).toContain("cc.is_active");
  expect(channels).not.toContain("NOT cc.needs_review");
  expect(channels).not.toContain("IS NOT NULL");
 });
 it("queries the latest staged or published revision without a manual current pointer",()=>{
  const schedule=service.slice(service.indexOf("private async publishedAirings("),service.indexOf("private coverage()"));
  expect(schedule).toContain("r.status IN ('STAGING','PUBLISHED')");
  expect(schedule).toContain("NOT EXISTS (SELECT 1 FROM public.tv_schedule_revision newer");
  expect(schedule).not.toContain("JOIN public.tv_schedule_current");
  expect(schedule).not.toContain("programme_rights_reference");
 });
 it("accepts global EPG sources consistently with private import",()=>{
  const schedule=service.slice(service.indexOf("private async publishedAirings("),service.indexOf("private coverage()"));
  expect(schedule).toContain("LEFT JOIN public.tv_source_country sc");
  expect(schedule).toContain("(sc.source_id IS NULL OR sc.is_active)");
  expect(schedule).toContain("sc.country_id=cc.country_id");
 });
 it("allows details and world search to use staged imports",()=>{
  const detail=service.slice(service.indexOf("async airingDetails("),service.indexOf("responseLanguages()"));
  const world=service.slice(service.indexOf("async worldSearch("));
  for(const value of [detail,world]){
   expect(value).toContain("r.status IN ('STAGING','PUBLISHED')");
   expect(value).not.toContain("JOIN public.tv_schedule_current");
  }
 });
});
