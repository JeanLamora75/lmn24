import {describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";
import {TvImportScheduler,dailyTvImportIsDue} from "./tv-import-scheduler";

function setup(enabled:boolean){
 const create=vi.fn().mockResolvedValue({id:"one",status:"QUEUED"});
 const service={create} as unknown as TvImportRunsService;
 const config={get:(key:string)=>{
  if(["TV_IMPORT_AUTOMATIC_ENABLED","TV_IMPORTS_ENABLED","TV_CATALOG_ADMIN_ENABLED"].includes(key))
    return enabled?"true":"false";
  return undefined;
 }} as unknown as ConfigService;
 return {scheduler:new TvImportScheduler(config,service),create};
}
describe("SCRUM-117 daily EPG scheduling (disabled until approved)",()=>{
 it("chooses one UTC hour independent of DST and country timezone",()=>{
  expect(dailyTvImportIsDue(new Date("2026-03-29T03:00:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-10-25T03:50:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-10-25T02:59:00Z"))).toBe(false);
 });
 it("never queues when explicitly gated off",async()=>{
  const {scheduler,create}=setup(false);
  expect(await scheduler.tick(new Date("2026-11-21T03:00:00Z"))).toBe(false);
  expect(create).not.toHaveBeenCalled();
  scheduler.onModuleInit();
  scheduler.onModuleDestroy();
 });
 it("requests automatic J0..J6 only when flags and UTC window allow",async()=>{
  const {scheduler,create}=setup(true);
  expect(await scheduler.tick(new Date("2026-11-21T02:59:00Z"))).toBe(false);
  expect(await scheduler.tick(new Date("2026-11-21T03:01:00Z"))).toBe(true);
  expect(create).toHaveBeenCalledExactlyOnceWith({trigger:"AUTOMATIC",days:7});
  scheduler.onModuleDestroy();
 });
});