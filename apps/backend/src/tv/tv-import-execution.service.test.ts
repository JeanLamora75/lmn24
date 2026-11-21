import {describe,expect,it,vi,beforeEach} from "vitest";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";

const mock=vi.hoisted(()=>({run:vi.fn()}));
vi.mock("./tv-import-authorized-runner",()=>({
 tvEpgExecutionApproved:(env:Record<string,string|undefined>)=>
  ["TV_CATALOG_ADMIN_ENABLED","TV_IMPORTS_ENABLED","TV_EPG_NETWORK_ENABLED",
   "TV_MIGRATION_QUALIFIED","TV_EPG_SOURCE_USE_APPROVED"]
    .every(key=>env[key]==="true"),
 runAuthorizedTvImport:mock.run,
}));
import {TvImportExecutionService} from "./tv-import-execution.service";

const runId="c7000000-0000-4000-8000-000000000001";
const keys=["TV_CATALOG_ADMIN_ENABLED","TV_IMPORTS_ENABLED","TV_EPG_NETWORK_ENABLED",
 "TV_MIGRATION_QUALIFIED","TV_EPG_SOURCE_USE_APPROVED"];
function setup(overrides:Record<string,string>={},status="QUEUED"){
 const vars:Record<string,string>={DATABASE_URL:"postgresql://fake:fake@localhost:5432/test"};
 for(const key of keys)vars[key]="true";
 Object.assign(vars,overrides);
 const config={get:(key:string)=>vars[key]} as unknown as ConfigService;
 const getRun=vi.fn().mockResolvedValue({id:runId,status,scopes:[]});
 const runs={getRun} as unknown as TvImportRunsService;
 return {service:new TvImportExecutionService(config,runs),getRun};
}
beforeEach(()=>{mock.run.mockReset();mock.run.mockResolvedValue({status:"SUCCESS"});});

describe("Admin manual discovery worker dispatch",()=>{
 it("fails closed before any DB or network work when operational flags missing",async()=>{
  for(const key of keys){
   const s=setup({[key]:"false"});
   expect(s.service.readiness()).toMatchObject({ready:false,publicPublication:false});
   await expect(s.service.startDiscovery(runId)).rejects.toMatchObject({status:503});
   expect(s.getRun).not.toHaveBeenCalled();
  }
  expect(mock.run).not.toHaveBeenCalled();
 });
 it("rejects a non-queued run and never contacts a provider",async()=>{
  const s=setup({},"SUCCESS");
  await expect(s.service.startDiscovery(runId)).rejects.toMatchObject({status:409});
  expect(mock.run).not.toHaveBeenCalled();
 });
 it("executes only discovery mode and never provides a coverage approval",async()=>{
  const s=setup();
  await expect(s.service.startDiscovery(runId)).resolves.toMatchObject({
   status:"STARTED",mode:"DISCOVERY",
  });
  expect(mock.run).toHaveBeenCalledOnce();
  expect(mock.run).toHaveBeenCalledWith(expect.objectContaining({
   runId,discoveryOnly:true,attest:expect.any(Function),
  }));
  const args=mock.run.mock.calls.at(0)?.[0] as {attest:(a:unknown)=>Promise<unknown[]>}|undefined;
  expect(args).toBeDefined();
  await expect(args?.attest({})).resolves.toEqual([]);
 });
 it("rejects repeated clicks while one worker is running",async()=>{
  let complete:((value:unknown)=>void)|undefined;
  mock.run.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const s=setup();
  await expect(s.service.startDiscovery(runId)).resolves.toMatchObject({status:"STARTED"});
  await expect(s.service.startDiscovery(runId)).rejects.toMatchObject({status:409});
  expect(mock.run).toHaveBeenCalledOnce();
  complete?.({status:"SUCCESS"});
 });
});
