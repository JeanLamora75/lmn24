import {describe,expect,it,vi,beforeEach} from "vitest";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";

const mock=vi.hoisted(()=>({run:vi.fn()}));
vi.mock("./tv-import-authorized-runner",()=>({
 tvEpgExecutionApproved:(env:Record<string,string|undefined>)=>
  ["TV_CATALOG_ADMIN_ENABLED","TV_IMPORTS_ENABLED","TV_EPG_NETWORK_ENABLED",
   "TV_MIGRATION_QUALIFIED","TV_EPG_SOURCE_USE_APPROVED"]
    .every(key=>env[key]==="true"),
 tvLocalDiscoveryApproved:(env:Record<string,string|undefined>,url:string)=>
  env.NODE_ENV!=="production"&&url.includes("@localhost:5432/lmn24")
  &&env.TV_CATALOG_ADMIN_ENABLED==="true"&&env.TV_IMPORTS_ENABLED==="true",
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
 const findQueuedManual=vi.fn().mockResolvedValue(null);
 const create=vi.fn().mockResolvedValue({id:runId,status:"QUEUED",scopeCount:1});
 const retryFailed=vi.fn().mockResolvedValue({id:runId,retried:1});
 const runs={getRun,findQueuedManual,create,retryFailed} as unknown as TvImportRunsService;
 return {service:new TvImportExecutionService(config,runs),getRun,findQueuedManual,create,retryFailed};
}
beforeEach(()=>{mock.run.mockReset();mock.run.mockResolvedValue({status:"SUCCESS"});});

describe("Admin manual discovery worker dispatch",()=>{
 it("allows an admin-triggered local discovery without production-only flags",async()=>{
  const s=setup({TV_EPG_NETWORK_ENABLED:"false",TV_MIGRATION_QUALIFIED:"false",
    TV_EPG_SOURCE_USE_APPROVED:"false"});
  // A local-development database is the only exception to production approvals.
  const previous=process.env.NODE_ENV;
  process.env.NODE_ENV="development";
  try{
   // Existing test setup uses a dummy DB name by default; no bypass permitted.
   await expect(s.service.launchManualImport({days:1,countryId:runId}))
    .rejects.toMatchObject({status:503});
  }finally{process.env.NODE_ENV=previous;}
  expect(s.create).not.toHaveBeenCalled();
 });
 it("starts local development discovery with one click without production ingestion flags",async()=>{
  const s=setup({DATABASE_URL:"postgresql://u:p@localhost:5432/lmn24",
   TV_EPG_NETWORK_ENABLED:"false",TV_MIGRATION_QUALIFIED:"false",
   TV_EPG_SOURCE_USE_APPROVED:"false"});
  const previous=process.env.NODE_ENV;
  process.env.NODE_ENV="development";
  try{
   await expect(s.service.launchManualImport({days:1,countryId:runId}))
    .resolves.toMatchObject({status:"STARTED",mode:"DISCOVERY"});
   expect(mock.run).toHaveBeenCalledOnce();
  }finally{process.env.NODE_ENV=previous;}
 });
 it("explicitly starts private programme staging with no coverage or public publication",async()=>{
  const s=setup();
  await expect(s.service.launchManualImport({
   days:1,countryId:runId,mode:"STAGING",
  })).resolves.toMatchObject({status:"STARTED",mode:"STAGING"});
  expect(s.create).toHaveBeenCalledWith({
   trigger:"MANUAL",days:1,countryId:runId,mode:"STAGING",
  });
  expect(mock.run).toHaveBeenCalledWith(expect.objectContaining({
   runId,discoveryOnly:false,stagingOnly:true,attest:expect.any(Function),
  }));
  const args=mock.run.mock.calls[0]?.[0] as {attest:(x:unknown)=>Promise<unknown[]>};
  await expect(args.attest({})).resolves.toEqual([]);
 });
 it("preserves staging mode when retrying failed scopes",async()=>{
  const s=setup();
  s.retryFailed.mockResolvedValue({id:runId,retried:1,mode:"STAGING"});
  await expect(s.service.retryFailedImport(runId))
   .resolves.toMatchObject({mode:"STAGING",retried:1});
  expect(mock.run).toHaveBeenCalledWith(expect.objectContaining({
   stagingOnly:true,discoveryOnly:false,
  }));
 });
 it("retries only failed scopes and immediately dispatches worker",async()=>{
  const s=setup();
  await expect(s.service.retryFailedImport(runId)).resolves.toMatchObject({
   status:"STARTED",mode:"DISCOVERY",retried:1,fromRunId:runId,
  });
  expect(s.retryFailed).toHaveBeenCalledWith(runId);
  expect(mock.run).toHaveBeenCalledOnce();
 });
 it("does not queue a retry if source execution is not allowed",async()=>{
  const s=setup({TV_EPG_NETWORK_ENABLED:"false"});
  await expect(s.service.retryFailedImport(runId)).rejects.toMatchObject({status:503});
  expect(s.retryFailed).not.toHaveBeenCalled();
  expect(mock.run).not.toHaveBeenCalled();
 });
 it("one click starts import, without leaving a merely queued success",async()=>{
  const s=setup();
  await expect(s.service.launchManualImport({days:1,countryId:runId}))
   .resolves.toMatchObject({id:runId,status:"STARTED",mode:"DISCOVERY",reusedPendingRun:false});
  expect(s.create).toHaveBeenCalledWith({trigger:"MANUAL",days:1,countryId:runId});
  expect(mock.run).toHaveBeenCalledOnce();
 });
 it("reuses a matching queued France run rather than creating a duplicate",async()=>{
  const s=setup();
  s.findQueuedManual.mockResolvedValue({id:runId});
  await expect(s.service.launchManualImport({days:1,countryId:runId}))
   .resolves.toMatchObject({id:runId,status:"STARTED",reusedPendingRun:true});
  expect(s.create).not.toHaveBeenCalled();
  expect(mock.run).toHaveBeenCalledOnce();
 });
 it("preflight blocks unapproved external network before creating any run",async()=>{
  const s=setup({TV_EPG_NETWORK_ENABLED:"false"});
  await expect(s.service.launchManualImport({days:1,countryId:runId}))
   .rejects.toMatchObject({status:503});
  expect(s.findQueuedManual).not.toHaveBeenCalled();
  expect(s.create).not.toHaveBeenCalled();
  expect(mock.run).not.toHaveBeenCalled();
 });
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
 it("rejects two simultaneous requests before either DB status lookup finishes",async()=>{
  let unblock:((row:{id:string;status:string})=>void)|undefined;
  const s=setup();
  s.getRun.mockImplementation(()=>new Promise(resolve=>{unblock=resolve;}));
  const first=s.service.startDiscovery(runId);
  await expect(s.service.startDiscovery(runId)).rejects.toMatchObject({status:409});
  expect(s.getRun).toHaveBeenCalledOnce();
  unblock?.({id:runId,status:"QUEUED"});
  await expect(first).resolves.toMatchObject({status:"STARTED"});
  expect(mock.run).toHaveBeenCalledOnce();
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
