import { describe,expect,it,vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { TvEpgSourcesService } from "./tv-epg-sources.service";
import { TvEpgSourcesController } from "./tv-epg-sources.controller";

const request={headers:{cookie:"lmn24_session=test"}};
const id="a1000000-0000-4000-8000-000000000001";
function setup(role:"ADMIN"|"EDITOR"|null,enabled=true){
 const listSources=vi.fn().mockResolvedValue([]);
 const testConnection=vi.fn().mockResolvedValue({ok:true,stage:"COMPLETE",code:null,bytes:123,programmes:1,channels:1,elapsedMs:5});
 const createSource=vi.fn().mockResolvedValue({id:"test"});
 const setRights=vi.fn().mockResolvedValue({id:"test"});
 const reviewExternalId=vi.fn().mockResolvedValue({id:"test"});
 const service={listSources,createSource,setRights,reviewExternalId,testConnection} as unknown as TvEpgSourcesService;
 const auth={getUserFromSession:vi.fn().mockResolvedValue(role?{id:"id",role}:null)} as unknown as AuthService;
 const config={get:(name:string)=>name==="TV_CATALOG_ADMIN_ENABLED"?(enabled?"true":"false"):name==="TV_IMPORTS_ENABLED"?"true":undefined} as unknown as ConfigService;
 return {c:new TvEpgSourcesController(auth,service,config),listSources,createSource,setRights,reviewExternalId,testConnection};
}
const right=(status:"UNREVIEWED"|"APPROVED"|"REJECTED"|"EXPIRED"="UNREVIEWED",reference:string|null=null)=>({status,reference});
const rights={programme:right(),synopsis:right(),image:right(),logo:right()};
describe("SCRUM-116 ADMIN EPG source security",()=>{
 it("refuses anonymous and editor before database access",async()=>{
  const anon=setup(null);
  await expect(anon.c.list(request)).rejects.toMatchObject({status:401});
  expect(anon.listSources).not.toHaveBeenCalled();
  const editor=setup("EDITOR");
  await expect(editor.c.list(request)).rejects.toMatchObject({status:403});
  expect(editor.listSources).not.toHaveBeenCalled();
 });
 it("refuses even ADMIN when feature flag is not enabled",async()=>{
  const s=setup("ADMIN",false);
  await expect(s.c.list(request)).rejects.toMatchObject({status:503});
  expect(s.listSources).not.toHaveBeenCalled();
 });
 it("only admins may run a real diagnostic for a stored source ID",async()=>{
  const anon=setup(null);
  await expect(anon.c.testConnection(request,id)).rejects.toMatchObject({status:401});
  expect(anon.testConnection).not.toHaveBeenCalled();
  const editor=setup("EDITOR");
  await expect(editor.c.testConnection(request,id)).rejects.toMatchObject({status:403});
  expect(editor.testConnection).not.toHaveBeenCalled();
  const disabled=setup("ADMIN",false);
  await expect(disabled.c.testConnection(request,id)).rejects.toMatchObject({status:503});
  await expect(setup("ADMIN").c.testConnection(request,"invalid")).rejects.toMatchObject({status:400});
  const admin=setup("ADMIN");
  await expect(admin.c.testConnection(request,id)).resolves.toMatchObject({ok:true,stage:"COMPLETE"});
  expect(admin.testConnection).toHaveBeenCalledWith(id);
 });
 it("records a manually selected right status without mandatory evidence",async()=>{
  const s=setup("ADMIN");
  await expect(s.c.create(request,{
   name:"EPG",sourceUrl:"https://epg.example.org/feed.xml",format:"XMLTV",
   isActive:false,rights:{...rights,image:right("APPROVED")},
  })).resolves.toEqual({id:"test"});
  expect(s.createSource).toHaveBeenCalledTimes(1);
  await expect(s.c.updateRights(request,id,{
   ...rights,programme:right("APPROVED"),
  })).resolves.toEqual({id:"test"});
  expect(s.setRights).toHaveBeenCalledTimes(1);
 });
 it("rejects name-only matching as VERIFIED",async()=>{
  const s=setup("ADMIN");
  await expect(s.c.reviewMapping(request,id,{
   sourceId:id,externalId:"candidate",channelId:null,variantId:null,status:"VERIFIED",
  })).rejects.toMatchObject({status:400});
  expect(s.reviewExternalId).not.toHaveBeenCalled();
 });
 it("accepts protected ADMIN read and valid per-family status",async()=>{
  const s=setup("ADMIN");
  await expect(s.c.list(request)).resolves.toEqual({items:[]});
  await expect(s.c.updateRights(request,id,{
   ...rights,programme:right("APPROVED","https://rights.example.org/licence"),
  })).resolves.toEqual({id:"test"});
  expect(s.setRights).toHaveBeenCalledTimes(1);
 });
});
