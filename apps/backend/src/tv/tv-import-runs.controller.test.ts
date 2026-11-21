import { describe,expect,it,vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { TvImportRunsService } from "./tv-import-runs.service";
import { TvImportRunsController } from "./tv-import-runs.controller";
import { TvImportExecutionService } from "./tv-import-execution.service";

const request={headers:{cookie:"lmn24_session=test"}};
const id="c7000000-0000-4000-8000-000000000001";
function setup(role:"ADMIN"|"EDITOR"|null,enabled=false){
 const create=vi.fn().mockResolvedValue({id,status:"QUEUED",scopeCount:2});
 const getRun=vi.fn().mockResolvedValue({id,status:"QUEUED"});
 const listRuns=vi.fn().mockResolvedValue({items:[],pagination:{page:1,pageSize:20,total:0,totalPages:0}});
 const getEvents=vi.fn().mockResolvedValue([]);
 const retryFailed=vi.fn().mockResolvedValue({id,retried:1});
 const service={create,getRun,getEvents,retryFailed,listRuns} as unknown as TvImportRunsService;
 const startDiscovery=vi.fn().mockResolvedValue({id,status:"STARTED",mode:"DISCOVERY"});
 const readiness=vi.fn().mockReturnValue({ready:false,mode:"DISCOVERY",missingFlags:["TV_EPG_NETWORK_ENABLED"],publicPublication:false});
 const execution={startDiscovery,readiness} as unknown as TvImportExecutionService;
 const auth={getUserFromSession:vi.fn().mockResolvedValue(role?{role}:null)} as unknown as AuthService;
 const config={get:(key:string)=>{
  if(key==="TV_IMPORTS_ENABLED"||key==="TV_CATALOG_ADMIN_ENABLED")return enabled?"true":"false";
  return undefined;
 }} as unknown as ConfigService;
 return {controller:new TvImportRunsController(auth,service,config,execution),create,getRun,getEvents,retryFailed,listRuns,startDiscovery,readiness};
}
describe("SCRUM-117 protected import orchestration",()=>{
 it("never reads/writes import data for anonymous users",async()=>{
  const s=setup(null,true);
  await expect(s.controller.enqueue(request,{days:7})).rejects.toMatchObject({status:401});
  expect(s.create).not.toHaveBeenCalled();
 });
 it("rejects EDITOR and disabled ADMIN",async()=>{
  const editor=setup("EDITOR",true);
  await expect(editor.controller.get(request,id)).rejects.toMatchObject({status:403});
  const admin=setup("ADMIN");
  await expect(admin.controller.retry(request,id)).rejects.toMatchObject({status:503});
  expect(admin.retryFailed).not.toHaveBeenCalled();
 });
 it("execution endpoint is admin-only, validates UUID and discovery mode",async()=>{
  const anon=setup(null,true);
  await expect(anon.controller.execute(request,id,{mode:"DISCOVERY"}))
   .rejects.toMatchObject({status:401});
  expect(anon.startDiscovery).not.toHaveBeenCalled();
  const editor=setup("EDITOR",true);
  await expect(editor.controller.executionStatus(request)).rejects.toMatchObject({status:403});
  await expect(editor.controller.execute(request,id,{mode:"DISCOVERY"}))
   .rejects.toMatchObject({status:403});
  expect(editor.startDiscovery).not.toHaveBeenCalled();
  const admin=setup("ADMIN",true);
  await expect(admin.controller.execute(request,"bad",{mode:"DISCOVERY"}))
   .rejects.toMatchObject({status:400});
  await expect(admin.controller.execute(request,id,{mode:"PUBLISH"}))
   .rejects.toMatchObject({status:400});
  await expect(admin.controller.execute(request,id,{})).rejects.toMatchObject({status:400});
  await expect(admin.controller.execute(request,id,{mode:"DISCOVERY"}))
   .resolves.toMatchObject({status:"STARTED",mode:"DISCOVERY"});
  expect(admin.startDiscovery).toHaveBeenCalledWith(id);
  await expect(admin.controller.executionStatus(request)).resolves.toMatchObject({
   ready:false,publicPublication:false,
  });
 });
 it("enforces days 1..7 and UUID, cannot enable automatic trigger via request",async()=>{
  const s=setup("ADMIN",true);
  for(const days of [0,8,1.5]){
   await expect(s.controller.enqueue(request,{days})).rejects.toMatchObject({status:400});
  }
  await expect(s.controller.enqueue(request,{days:1,trigger:"AUTOMATIC"}))
   .rejects.toMatchObject({status:400});
  await expect(s.controller.enqueue(request,{days:3,countryId:"bad"}))
   .rejects.toMatchObject({status:400});
  expect(s.create).not.toHaveBeenCalled();
 });
 it("allows an authorized manual run, status, events and targeted retry",async()=>{
  const s=setup("ADMIN",true);
  await expect(s.controller.enqueue(request,{days:7})).resolves.toMatchObject({status:"QUEUED"});
  expect(s.create).toHaveBeenCalledWith({days:7,trigger:"MANUAL"});
  await expect(s.controller.get(request,id)).resolves.toMatchObject({id});
  await expect(s.controller.events(request,id)).resolves.toEqual({items:[]});
  await expect(s.controller.retry(request,id)).resolves.toMatchObject({retried:1});
 });
 it("SCRUM-122 denies import history to unauthorized users and validates page limits",async()=>{
  const anonymous=setup(null,true);
  await expect(anonymous.controller.list(request)).rejects.toMatchObject({status:401});
  expect(anonymous.listRuns).not.toHaveBeenCalled();
  const editor=setup("EDITOR",true);
  await expect(editor.controller.list(request)).rejects.toMatchObject({status:403});
  const disabled=setup("ADMIN",false);
  await expect(disabled.controller.list(request)).rejects.toMatchObject({status:503});
  const authorized=setup("ADMIN",true);
  await expect(authorized.controller.list(request,"0")).rejects.toMatchObject({status:400});
  await expect(authorized.controller.list(request,"1","101")).rejects.toMatchObject({status:400});
  await expect(authorized.controller.list(request,"2","15")).resolves.toMatchObject({items:[]});
  expect(authorized.listRuns).toHaveBeenCalledWith(2,15);
 });

});
