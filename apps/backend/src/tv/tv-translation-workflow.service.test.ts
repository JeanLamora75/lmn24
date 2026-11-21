import {afterEach,describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {DatabaseService} from "../database/database.service";
import {TvTranslationWorkflowService} from "./tv-translation-workflow.service";

const channel="f1000000-0000-4000-8000-000000000001";
const provider="f2000000-0000-4000-8000-000000000002";
const endpoint="http://127.0.0.1:5000/translate";
type DBOptions={selected?:boolean;sourceOrigin?:"SOURCE"|"MANUAL";sourceVersion?:string;
 approvalSourceVersion?:string;alreadyPresent?:string[]};
function setup(opts:DBOptions={}){
 const rows=vi.fn(async(strings:TemplateStringsArray,...values:unknown[])=>{
  const sql=strings.join("");
  if(sql.includes("to_regclass("))return [{ok:true}];
  if(sql.includes("FROM public.tv_translation_provider WHERE is_selected=TRUE"))
   return opts.selected===false?[]:[{id:provider,providerType:"LIBRETRANSLATE_LOCAL",
    endpoint,isActive:true,freeApproved:true,rightsReviewed:true}];
  if(sql.includes("FROM public.tv_channel_description")&&sql.includes("FOR UPDATE"))
   return [{version:opts.approvalSourceVersion??"version-1"}];
  if(sql.includes("FROM public.tv_channel_description"))
   return [{languageCode:"fr",content:"Description rédigée par l'administrateur",
    origin:opts.sourceOrigin??"MANUAL",version:opts.sourceVersion??"version-1"}];
  if(sql.includes("FROM public.tv_translation_attempt"))return [];
  if(sql.includes("INSERT INTO public.tv_channel_description")){
   return opts.alreadyPresent?.includes(String(values[1]))?[]:
    [{languageCode:String(values[1])}];
  }
  throw new Error("Unexpected query: "+sql);
 });
 const executes=vi.fn(async()=>1);
 const prisma={$queryRaw:rows,$executeRaw:executes,
  $transaction:vi.fn(async(fn:(tx:{ $queryRaw:typeof rows;$executeRaw:typeof executes})=>Promise<unknown>)=>
   fn({$queryRaw:rows,$executeRaw:executes}))};
 const db={prisma} as unknown as DatabaseService;
 const config={get:(key:string)=>({
  TV_TRANSLATION_LOCAL_ENABLED:"true",
  TV_TRANSLATION_LOCAL_ENDPOINT:endpoint,
 } as Record<string,string>)[key]} as unknown as ConfigService;
 return {service:new TvTranslationWorkflowService(db,config),rows,executes};
}
afterEach(()=>vi.unstubAllGlobals());
describe("SCRUM-123 translation provider safety and zero-loss preview",()=>{
 it("never contacts a paid or absent provider",async()=>{
  const {service}=setup({selected:false});
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(service.preview(channel,"fr")).rejects.toMatchObject({status:503});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("blocks untraceable EPG source licensing before external transmission",async()=>{
  const {service}=setup({sourceOrigin:"SOURCE"});
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(service.preview(channel,"fr")).rejects.toMatchObject({status:409});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("preserves successes in PARTIAL and labels unsupported separately",async()=>{
  const {service,executes}=setup();
  const fetcher=vi.fn(async(_url:string,init:RequestInit)=>{
   const target=JSON.parse(String(init.body)).target as string;
   if(target==="es")return {ok:false,status:503,headers:new Headers(),text:async()=>""};
   if(target==="nl")return {ok:false,status:422,headers:new Headers(),text:async()=>""};
   return {ok:true,status:200,headers:new Headers(),
    text:async()=>JSON.stringify({translatedText:"Texte "+target})};
  });
  vi.stubGlobal("fetch",fetcher);
  const result=await service.preview(channel,"fr");
  expect(result.status).toBe("PARTIAL");
  expect(result.failed).toEqual(["es"]);
  expect(result.unsupported).toEqual(["nl"]);
  expect(result.translated).toMatchObject({en:"Texte en"});
  expect(result.previewId).toEqual(expect.any(String));
  expect(executes).toHaveBeenCalledTimes(2);
 });
 it("rejects approval when source changed after preview (late MANUAL edit)",async()=>{
  const {service}=setup({approvalSourceVersion:"edited-just-now"});
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,headers:new Headers(),
   text:async()=>JSON.stringify({translatedText:"Text"})})));
  const result=await service.preview(channel,"fr");
  await expect(service.approve(channel,result.previewId!,["en"])).rejects.toMatchObject({status:409});
 });
 it("does not overwrite an existing target created after preview",async()=>{
  const {service}=setup({alreadyPresent:["en"]});
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,headers:new Headers(),
   text:async()=>JSON.stringify({translatedText:"Text"})})));
  const result=await service.preview(channel,"fr");
  // The approval uses INSERT ... ON CONFLICT DO NOTHING; a target created
  // while the preview is open remains protected, never UPDATEd.
  const approved=await service.approve(channel,result.previewId!,["en"]);
  expect(approved).toMatchObject({saved:[],conflicts:["en"],status:"PARTIAL"});
 });
});
