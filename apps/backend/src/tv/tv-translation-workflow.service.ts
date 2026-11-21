import {randomUUID} from "node:crypto";
import {ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {DatabaseService} from "../database/database.service";
import {isTvLocale,retryLanguages,sanitizeTranslation,type DescriptionSnapshot,
 type AttemptSnapshot,type TvLocale} from "./tv-translation-policy";

type Proposal={channelId:string;sourceLanguage:TvLocale;sourceVersion:string;
 providerId:string;translated:Record<string,string>;createdAt:number};
const MAX_PREVIEWS=100;
const TTL_MS=10*60_000;
const LOCALES=["fr","en","de","es","pt","it","ru","nl"] as const;
@Injectable()
export class TvTranslationWorkflowService{
 private readonly previews=new Map<string,Proposal>();
 constructor(private readonly db:DatabaseService,private readonly config:ConfigService){}
 private async requireTables(){
  const r=await this.db.prisma.$queryRaw<Array<{ok:boolean}>>`
   SELECT to_regclass('public.tv_translation_provider') IS NOT NULL
     AND to_regclass('public.tv_channel_description') IS NOT NULL
     AND to_regclass('public.tv_translation_attempt') IS NOT NULL AS ok`;
  if(!r[0]?.ok)throw new ServiceUnavailableException("TV translation schema is absent");
 }
 private async descriptions(channelId:string){
  const result=await this.db.prisma.$queryRaw<Array<DescriptionSnapshot>>`
   SELECT language_code AS "languageCode",content,origin,updated_at::text AS version
   FROM public.tv_channel_description WHERE channel_id=${channelId}::uuid`;
  return result;
 }
 private async attempts(channelId:string){
  return this.db.prisma.$queryRaw<Array<AttemptSnapshot>>`
   SELECT DISTINCT ON (target_language) target_language AS "languageCode",status
   FROM public.tv_translation_attempt WHERE channel_id=${channelId}::uuid
   ORDER BY target_language,occurred_at DESC,id DESC`;
 }
 private async selected(){
  const rows=await this.db.prisma.$queryRaw<Array<{
   id:string;providerType:string;endpoint:string;isActive:boolean;
   freeApproved:boolean;rightsReviewed:boolean;
  }>>`
   SELECT id,provider_type AS "providerType",endpoint,is_active AS "isActive",
    free_approved_at IS NOT NULL AS "freeApproved",
    rights_reviewed_at IS NOT NULL AS "rightsReviewed"
   FROM public.tv_translation_provider WHERE is_selected=TRUE`;
  const p=rows[0];
  if(!p||!p.isActive||!p.freeApproved||!p.rightsReviewed)
   throw new ServiceUnavailableException("TV_TRANSLATION_NO_APPROVED_PROVIDER");
  return p;
 }
 private localEndpoint(provider:{providerType:string;endpoint:string}){
  // No card/no payment API: support only a locally operated open-source adapter.
  // Caller cannot control destination; strict loopback URL and explicit feature gate.
  const configured=this.config.get<string>("TV_TRANSLATION_LOCAL_ENDPOINT")?.trim();
  if(this.config.get<string>("TV_TRANSLATION_LOCAL_ENABLED")!=="true"||!configured)
   throw new ServiceUnavailableException("TV_TRANSLATION_LOCAL_NOT_ENABLED");
  let url:URL;
  try{url=new URL(configured);}catch{
   throw new ServiceUnavailableException("Invalid local translation endpoint");
  }
  if(url.protocol!=="http:"||url.hostname!=="127.0.0.1"||
    url.username||url.password||url.search||url.hash||url.pathname!=="/translate"||
    !url.port)
   throw new ServiceUnavailableException("Translation adapter must be loopback-only");
  if(provider.providerType!=="LIBRETRANSLATE_LOCAL"||provider.endpoint!==url.toString())
   throw new ServiceUnavailableException("Selected provider does not match approved local adapter");
  return url.toString();
 }
 async statuses(channelId:string){
  await this.requireTables();
  const [descriptions,attempts]=await Promise.all([
   this.descriptions(channelId),this.attempts(channelId)]);
  const {statusForLanguage}=await import("./tv-translation-policy");
  return {items:LOCALES.map(language=>({
   language,status:statusForLanguage(language,descriptions,attempts),
   description:descriptions.find(d=>d.languageCode===language)??null,
  }))};
 }
 private async translate(endpoint:string,content:string,source:TvLocale,target:TvLocale){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(endpoint,{method:"POST",
    headers:{"content-type":"application/json"},redirect:"error",signal:controller.signal,
    body:JSON.stringify({q:content,source,target,format:"text"})});
   if(!response.ok||Number(response.headers.get("content-length")??0)>30000)
    throw new Error("TRANSLATION_PROVIDER_UNAVAILABLE");
   const raw=await response.text();
   if(raw.length>30000)throw new Error("TRANSLATION_RESPONSE_TOO_LARGE");
   const body:unknown=JSON.parse(raw);
   const value=sanitizeTranslation(body&&typeof body==="object"&&
     "translatedText" in body?(body as {translatedText:unknown}).translatedText:null);
   if(!value)throw new Error("TRANSLATION_EMPTY_RESULT");
   return value;
  }finally{clearTimeout(timeout);}
 }
 async preview(channelId:string,sourceLanguage:TvLocale){
  await this.requireTables();
  const provider=await this.selected();
  const endpoint=this.localEndpoint(provider);
  const [descriptions,attempts]=await Promise.all([
   this.descriptions(channelId),this.attempts(channelId)]);
  const source=descriptions.find(d=>d.languageCode===sourceLanguage);
  if(!source||!source.content.trim())
   throw new ConflictException("TV_TRANSLATION_SOURCE_MISSING");
  const targets=retryLanguages(descriptions,attempts,sourceLanguage);
  if(!targets.length)return {status:"COMPLETE" as const,previewId:null,
   translated:{},failed:[],unsupported:[],missing:[]};
  const translated:Record<string,string>={};
  const failed:string[]=[];
  for(const target of targets){
   try{translated[target]=await this.translate(endpoint,source.content,sourceLanguage,target);}
   catch{
    failed.push(target);
    // Deliberately no raw provider error or credentials in stored logs.
    await this.db.prisma.$executeRaw`
     INSERT INTO public.tv_translation_attempt(channel_id,provider_id,target_language,status)
     VALUES(${channelId}::uuid,${provider.id}::uuid,${target},'ERROR')`;
   }
  }
  const previewId=Object.keys(translated).length?randomUUID():null;
  if(previewId){
   for(const [key,value] of this.previews){
    if(Date.now()-value.createdAt>TTL_MS)this.previews.delete(key);
   }
   if(this.previews.size>=MAX_PREVIEWS)this.previews.delete(this.previews.keys().next().value!);
   this.previews.set(previewId,{channelId,sourceLanguage,sourceVersion:source.version,
    providerId:provider.id,translated,createdAt:Date.now()});
  }
  return {status:failed.length?"PARTIAL":"READY",previewId,translated,
   failed,unsupported:[],missing:[],providerId:provider.id};
 }
 async approve(channelId:string,previewId:string,languages:string[]){
  await this.requireTables();
  const proposal=this.previews.get(previewId);
  if(!proposal||proposal.channelId!==channelId||Date.now()-proposal.createdAt>TTL_MS)
   throw new ConflictException("TV_TRANSLATION_PREVIEW_EXPIRED");
  if(languages.length===0||new Set(languages).size!==languages.length||
    languages.some(l=>!isTvLocale(l)||!proposal.translated[l]))
   throw new ConflictException("Invalid translation selection");
  const provider=await this.selected();
  if(provider.id!==proposal.providerId)throw new ConflictException("TV_PROVIDER_CHANGED");
  const result=await this.db.prisma.$transaction(async tx=>{
   const source=await tx.$queryRaw<Array<{version:string}>>`
    SELECT updated_at::text AS version FROM public.tv_channel_description
    WHERE channel_id=${channelId}::uuid AND language_code=${proposal.sourceLanguage}
    FOR UPDATE`;
   if(source[0]?.version!==proposal.sourceVersion)
    throw new ConflictException("TV_TRANSLATION_SOURCE_CHANGED");
   const saved:string[]=[];const conflicts:string[]=[];
   for(const language of languages){
    const text=proposal.translated[language]!;
    // INSERT only; an existing SOURCE, MANUAL or MACHINE value is never overwritten.
    const row=await tx.$queryRaw<Array<{languageCode:string}>>`
     INSERT INTO public.tv_channel_description(channel_id,language_code,content,origin,provider_id)
     VALUES(${channelId}::uuid,${language},${text},'MACHINE',${provider.id}::uuid)
     ON CONFLICT(channel_id,language_code) DO NOTHING
     RETURNING language_code AS "languageCode"`;
    if(row[0]){
     saved.push(language);
     await tx.$executeRaw`
      INSERT INTO public.tv_translation_attempt(channel_id,provider_id,target_language,status)
      VALUES(${channelId}::uuid,${provider.id}::uuid,${language},'SUCCESS')`;
    }else conflicts.push(language);
   }
   return {saved,conflicts,status:conflicts.length?"PARTIAL":"SUCCESS"};
  });
  this.previews.delete(previewId);
  return result;
 }
}
