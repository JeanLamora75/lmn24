import {describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";
import {TvImportExecutionService} from "./tv-import-execution.service";
import {TvImportScheduler,dailyTvImportIsDue} from "./tv-import-scheduler";

function setup(options:{automatic?:boolean;ready?:boolean;alreadyScheduled?:boolean}={}){
 const create=vi.fn().mockResolvedValue(
  options.alreadyScheduled
   ?{id:"one",status:"SUCCESS",alreadyScheduled:true}
   :{id:"one",status:"QUEUED",scopeCount:2});
 const startRun=vi.fn().mockResolvedValue({id:"one",status:"STARTED"});
 const runs={create} as unknown as TvImportRunsService;
 const execution={readiness:()=>({ready:options.ready??true}),startRun} as unknown as TvImportExecutionService;
 const config={get:(key:string)=>key==="TV_IMPORT_AUTOMATIC_ENABLED"
  ?(options.automatic??true)?"true":"false":undefined} as unknown as ConfigService;
 return {scheduler:new TvImportScheduler(config,runs,execution),create,startRun};
}
describe("Daily TV EPG refresh at 04:00 Europe/Paris",()=>{
 it("observes both DST boundaries and rejects other hours",()=>{
  expect(dailyTvImportIsDue(new Date("2026-03-28T03:00:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-03-29T02:00:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-10-25T03:00:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-10-25T02:59:00Z"))).toBe(false);
  expect(dailyTvImportIsDue(new Date("2026-11-21T03:01:00Z"))).toBe(true);
  expect(dailyTvImportIsDue(new Date("2026-11-21T02:59:00Z"))).toBe(false);
  expect(dailyTvImportIsDue(new Date("2026-11-21T03:00:00Z"),24)).toBe(false);
 });
 it("does nothing with the feature gate off",async()=>{
  const {scheduler,create,startRun}=setup({automatic:false});
  expect(await scheduler.tick(new Date("2026-11-21T03:01:00Z"))).toBe(false);
  expect(create).not.toHaveBeenCalled();
  expect(startRun).not.toHaveBeenCalled();
 });
 it("does nothing without full operational approval",async()=>{
  const {scheduler,create}=setup({ready:false});
  expect(await scheduler.tick(new Date("2026-11-21T03:01:00Z"))).toBe(false);
  expect(create).not.toHaveBeenCalled();
 });
 it("starts a real seven-day private import",async()=>{
  const {scheduler,create,startRun}=setup();
  expect(await scheduler.tick(new Date("2026-11-21T03:01:00Z"))).toBe(true);
  expect(create).toHaveBeenCalledExactlyOnceWith({
   trigger:"AUTOMATIC",days:7,mode:"STAGING",
  });
  expect(startRun).toHaveBeenCalledExactlyOnceWith("one","STAGING");
 });
 it("does not redispatch an already scheduled job",async()=>{
  const {scheduler,startRun}=setup({alreadyScheduled:true});
  expect(await scheduler.tick(new Date("2026-11-21T03:01:00Z"))).toBe(false);
  expect(startRun).not.toHaveBeenCalled();
 });
 it("does not start if creation fails",async()=>{
  const {scheduler,create,startRun}=setup();
  create.mockRejectedValueOnce(new Error("TV_IMPORT_SCOPE_BUSY"));
  await expect(scheduler.tick(new Date("2026-11-21T03:01:00Z"))).rejects.toThrow("TV_IMPORT_SCOPE_BUSY");
  expect(startRun).not.toHaveBeenCalled();
 });
});
