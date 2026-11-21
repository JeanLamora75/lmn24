import { describe,expect,it,vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { TvEpgSourcesService } from "./tv-epg-sources.service";
import { TvEpgSourcesController } from "./tv-epg-sources.controller";

const request={headers:{cookie:"lmn24_session=test"}};
const id="a1000000-0000-4000-8000-000000000001";
function setup(role:"ADMIN"|"EDITOR"|null,enabled=true){
 const listSources=vi.fn().mockResolvedValue([]);
 const listPendingDiscoveries=vi.fn().mockResolvedValue({total:1,items:[]});
 const importDiscoveredChannels=vi.fn().mockResolvedValue({created:1,existing:0,requiresReview:true,published:0});
 const listCountryPriorities=vi.fn().mockResolvedValue({countryId:id,items:[]});
 const replaceCountryPriorities=vi.fn().mockResolvedValue({countryId:id,updated:1});
 const testConnection=vi.fn().mockResolvedValue({ok:true,stage:"COMPLETE",code:null,bytes:123,programmes:1,channels:1,elapsedMs:5});
 const createSource=vi.fn().mockResolvedValue({id:"test"});
 const setRights=vi.fn().mockResolvedValue({id:"test"});
 const reviewExternalId=vi.fn().mockResolvedValue({id:"test"});
 const service={listSources,listPendingDiscoveries,importDiscoveredChannels,listCountryPriorities,replaceCountryPriorities,createSource,setRights,reviewExternalId,testConnection} as unknown as TvEpgSourcesService;
 const auth={getUserFromSession:vi.fn().mockResolvedValue(role?{id:"id",role}:null)} as unknown as AuthService;
 const config={get:(name:string)=>name==="TV_CATALOG_ADMIN_ENABLED"?(enabled?"true":"false"):name==="TV_IMPORTS_ENABLED"?"true":undefined} as unknown as ConfigService;
 return {c:new TvEpgSourcesController(auth,service,config),listSources,listPendingDiscoveries,importDiscoveredChannels,listCountryPriorities,replaceCountryPriorities,createSource,setRights,reviewExternalId,testConnection};
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
 it("protects country priority reading and replacement with admin auth and validation",async()=>{
  const anon=setup(null);
  await expect(anon.c.listCountryPriorities(request,id)).rejects.toMatchObject({status:401});
  expect(anon.listCountryPriorities).not.toHaveBeenCalled();
  const editor=setup("EDITOR");
  await expect(editor.c.listCountryPriorities(request,id)).rejects.toMatchObject({status:403});
  await expect(editor.c.replacePriorities(request,id,{items:[]})).rejects.toMatchObject({status:403});
  const admin=setup("ADMIN");
  await expect(admin.c.listCountryPriorities(request,"bad")).rejects.toMatchObject({status:400});
  await expect(admin.c.listCountryPriorities(request,id)).resolves.toEqual({countryId:id,items:[]});
  expect(admin.listCountryPriorities).toHaveBeenCalledWith(id);
  await expect(admin.c.replacePriorities(request,id,{items:[{
   sourceId:id,countryId:id,priority:1,isActive:true,
  }]})).resolves.toMatchObject({updated:1});
  expect(admin.replaceCountryPriorities).toHaveBeenCalledTimes(1);
  await expect(admin.c.replacePriorities(request,id,{items:[{
   sourceId:id,countryId:id,priority:0,isActive:true,
  }]})).rejects.toMatchObject({status:400});
 });
 it("lists pending EPG channels and restricts catalogue creation to admin with explicit country",async()=>{
  const anon=setup(null);
  await expect(anon.c.listDiscoveries(request,"1","")).rejects.toMatchObject({status:401});
  await expect(anon.c.importDiscoveries(request,{countryId:id,mappingIds:[id]}))
   .rejects.toMatchObject({status:401});
  expect(anon.importDiscoveredChannels).not.toHaveBeenCalled();
  const editor=setup("EDITOR");
  await expect(editor.c.importDiscoveries(request,{countryId:id,mappingIds:[id]}))
   .rejects.toMatchObject({status:403});
  const admin=setup("ADMIN");
  await expect(admin.c.listDiscoveries(request,"1",""))
   .resolves.toEqual({total:1,items:[]});
  expect(admin.listPendingDiscoveries).toHaveBeenCalledWith(50,0,"");
  for(const body of [{mappingIds:[id]},{countryId:id,mappingIds:[]},
    {countryId:id,mappingIds:[id,id]},{countryId:"invalid",mappingIds:[id]}]){
   await expect(admin.c.importDiscoveries(request,body))
    .rejects.toMatchObject({status:400});
  }
  await expect(admin.c.importDiscoveries(request,{countryId:id,mappingIds:[id]}))
   .resolves.toMatchObject({created:1,published:0,requiresReview:true});
  expect(admin.importDiscoveredChannels).toHaveBeenCalledWith(id,[id]);
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
