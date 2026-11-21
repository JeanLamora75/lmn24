import { createHash } from "node:crypto";
import { parseStringPromise } from "xml2js";
import { z } from "zod";
import { EPG_FETCH_LIMITS, type EpgFormat } from "./tv-epg-source-policy";

// Bounded by payload bytes and emission count; neither limit alone is sufficient.
// A streaming decoder is still required before supporting larger feeds.
const MAX_PROGRAMMES = 250_000;
const MAX_CONTENT = EPG_FETCH_LIMITS.maxExpandedBytes;
const text = (value:unknown,max=1000):string|null=>{
  if(typeof value==="string")return value.trim().slice(0,max)||null;
  if(Array.isArray(value))return text(value[0],max);
  if(value && typeof value==="object" && "_" in value) return text((value as {_?:unknown})._,max);
  return null;
};
export type EpgProgramme = {
  externalChannelId:string;externalProgrammeId:string;startsAt:string;endsAt:string;
  originalTitle:string;originalSynopsis:string|null;category:string|null;
  imageUrl:string|null;fingerprint:string;
};
export type EpgCoverageClaim = {
  externalChannelId:string;startsAt:string;endsAt:string;
  /** Claim is untrusted until source licence/coverage independently verified. */
  verified:boolean;
};
export type EpgDecoded = {programmes:EpgProgramme[];coverage:EpgCoverageClaim[]};

const validIso=(value:string):string=>{
  if(!/^(?:19|20|21)\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value))
    throw new Error("Invalid EPG timestamp");
  const n=Date.parse(value);
  if(!Number.isFinite(n))throw new Error("Invalid EPG timestamp");
  return new Date(n).toISOString();
};
/** XMLTV offset is mandatory; never silently use server or visitor timezone. */
export function parseXmltvTime(raw:string):string {
  const match=/^((?:19|20|21)\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-])(\d{2})(\d{2})$/.exec(raw);
  if(!match)throw new Error("XMLTV timestamp must include timezone offset");
  const [,_y,_mo,_day,_h,_min,_sec,sign,offsetHour,offsetMinute]=match;
  const utc=`${_y}-${_mo}-${_day}T${_h}:${_min}:${_sec}Z`;
  const t=Date.parse(utc);
  const offset=Number(offsetHour)*60+Number(offsetMinute);
  if(!Number.isFinite(t)||offset>14*60||Number(offsetMinute)>59 ||
    new Date(t).toISOString().slice(0,19)!==utc.slice(0,19))
    throw new Error("Invalid XMLTV calendar time");
  return new Date(t+(sign==="+"?-1:1)*offset*60_000).toISOString();
}
function makeProgramme(raw:{
  channel:string;externalId:string;start:string;end:string;title:string;
  synopsis?:string|null|undefined;category?:string|null|undefined;image?:string|null|undefined;
}):EpgProgramme{
  const startsAt=validIso(raw.start),endsAt=validIso(raw.end);
  if(Date.parse(endsAt)<=Date.parse(startsAt) || Date.parse(endsAt)-Date.parse(startsAt)>48*3_600_000)
    throw new Error("Invalid EPG duration");
  if(!raw.channel.trim()||!raw.title.trim()||!raw.externalId.trim())throw new Error("Missing EPG identity");
  const fp=createHash("sha256").update([raw.channel,raw.externalId,startsAt,endsAt].join("|")).digest("hex");
  return {
    externalChannelId:raw.channel.trim().slice(0,500),
    externalProgrammeId:raw.externalId.trim().slice(0,500),
    startsAt,endsAt,originalTitle:raw.title.trim().slice(0,1000),
    originalSynopsis:raw.synopsis?.trim().slice(0,10000)||null,
    category:raw.category?.trim().slice(0,120)||null,
    imageUrl:raw.image?.trim().slice(0,2048)||null,
    fingerprint:fp,
  };
}
const item=z.object({
  channel:z.string().min(1),id:z.string().min(1),start:z.string(),end:z.string(),
  title:z.string().min(1),synopsis:z.string().nullish(),category:z.string().nullish(),
  imageUrl:z.string().nullish(),
}).strict();
const claim=z.object({
  channel:z.string().min(1),start:z.string(),end:z.string(),
  verified:z.literal(true),
}).strict();
const jsonRoot=z.object({
  programmes:z.array(item).max(MAX_PROGRAMMES),
  coverage:z.array(claim).max(MAX_PROGRAMMES).optional(),
}).strict();
export async function decodeEpgBuffer(data:Buffer,format:EpgFormat):Promise<EpgDecoded>{
  if(data.byteLength>MAX_CONTENT)throw new Error("EPG payload too large");
  const utf8=new TextDecoder("utf-8",{fatal:true}).decode(data);
  if(format==="JSON"){
    const parsed=jsonRoot.parse(JSON.parse(utf8) as unknown);
    return {
      programmes:parsed.programmes.map(p=>makeProgramme({
        channel:p.channel,externalId:p.id,start:p.start,end:p.end,title:p.title,
        synopsis:p.synopsis,category:p.category,image:p.imageUrl,
      })),
      coverage:(parsed.coverage??[]).map(c=>({
        externalChannelId:c.channel,startsAt:validIso(c.start),
        endsAt:validIso(c.end),verified:false, // untrusted source claim, NOT proven coverage
      })),
    };
  }
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(utf8))throw new Error("XML declarations forbidden");
  const document:unknown=await parseStringPromise(utf8,{
    explicitArray:true,explicitRoot:true,trim:true,normalize:false,
    strict:true,mergeAttrs:false,explicitCharkey:false,
  });
  if(!document||typeof document!=="object"||!("tv" in document))throw new Error("Invalid XMLTV root");
  const root=(document as {tv?:unknown}).tv;
  if(!root||typeof root!=="object")throw new Error("Invalid XMLTV contents");
  const programmes=(root as {programme?:unknown}).programme;
  if(!Array.isArray(programmes))return {programmes:[],coverage:[]};
  if(programmes.length>MAX_PROGRAMMES)throw new Error("XMLTV programme limit");
  const results:EpgProgramme[]=[];
  for(const raw of programmes){
    if(!raw||typeof raw!=="object"||!("$" in raw))throw new Error("Malformed XMLTV programme");
    const p=raw as Record<string,unknown>;
    const attrs=p["$"] as Record<string,unknown>;
    const channel=text(attrs.channel),start=text(attrs.start),end=text(attrs.stop);
    const title=text(p.title);
    if(!channel||!start||!end||!title)throw new Error("Incomplete XMLTV item");
    const icon=Array.isArray(p.icon)?p.icon[0] as {$?:{src?:string}}|undefined:undefined;
    results.push(makeProgramme({
      channel,externalId:text(attrs.id)||channel+"|"+start,
      start:parseXmltvTime(start),end:parseXmltvTime(end),title,
      synopsis:text(p.desc,10000),category:text(p.category,120),image:icon?.$?.src,
    }));
  }
  // XMLTV programme lists do NOT prove completeness of a day.
  return {programmes:results,coverage:[]};
}
