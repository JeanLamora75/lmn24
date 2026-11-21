import { createHash } from "node:crypto";
import { Parser } from "xml2js";
import { z } from "zod";
import { EPG_FETCH_LIMITS, type EpgFormat } from "./tv-epg-source-policy";
import {assertSafeXmltvDeclarations,isAllowedXmltvDoctype} from "./tv-xmltv-doctype";

// Bounded by payload bytes and emission count; neither limit alone is sufficient.
// Transport still buffers the bounded downloaded payload; SAX parsing is incremental.
const MAX_PROGRAMMES = 250_000;
const MAX_CONTENT = EPG_FETCH_LIMITS.maxExpandedBytes;
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
export type EpgDecoded = {programmes:EpgProgramme[];coverage:EpgCoverageClaim[];skippedInvalidDuration?:number};

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
  if(format==="JSON"){
    const utf8=new TextDecoder("utf-8",{fatal:true}).decode(data);
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
  // Enforce the same DTD/entity policy for direct decoder calls as for downloads.
  assertSafeXmltvDeclarations(data.toString("utf8"));
  // xml2js uses the SAX parser internally. Process its XML events directly,
  // rather than materializing the entire <tv> document and all programme nodes.
  // Input is fed in bounded chunks so the parser only holds one item at a time.
  const sax=new Parser({strict:true}).saxParser;
  const results:EpgProgramme[]=[];
  let skippedInvalidDuration=0;
  let depth=0,rootSeen=false,programme:({
    channel:string;externalId:string;start:string;end:string;
    title:string;synopsis:string;category:string;image:string;
  })|null=null;
  let capture:"title"|"desc"|"category"|null=null;
  let captured="";
  sax.onopentag=(node)=>{
    depth++;
    if(depth===1){
      if(node.name!=="tv")throw new Error("Invalid XMLTV root");
      rootSeen=true;
      return;
    }
    if(depth===2 && node.name==="programme"){
      const a=node.attributes;
      const channel=a.channel?.trim()??"";
      const start=a.start?.trim()??"";
      programme={channel,externalId:a.id?.trim()||channel+"|"+start,
        start,end:a.stop?.trim()??"",title:"",synopsis:"",category:"",image:""};
      return;
    }
    if(programme && depth===3){
      if(node.name==="icon"&&!programme.image)
        programme.image=node.attributes.src?.slice(0,2048)??"";
      if((node.name==="title"||node.name==="desc"||node.name==="category")
         && !capture){
        capture=node.name;
        captured="";
      }
    }
  };
  const appendText=(value:string)=>{
    if(!capture)return;
    const limit=capture==="desc"?10000:capture==="category"?120:1000;
    if(captured.length<limit)captured+=value.slice(0,limit-captured.length);
  };
  sax.ontext=appendText;
  sax.oncdata=appendText;
  // SAX never retrieves a DTD. Verify only the exact inert identifiers.
  sax.ondoctype=(value)=>{
    if(!isAllowedXmltvDoctype(value))
      throw new Error("EPG_XML_SECURITY_REJECTED");
  };
  sax.onclosetag=(name)=>{
    if(programme && capture===name && depth===3){
      const value=captured.trim();
      if(capture==="title"&&!programme.title)programme.title=value;
      if(capture==="desc"&&!programme.synopsis)programme.synopsis=value;
      if(capture==="category"&&!programme.category)programme.category=value;
      capture=null;
      captured="";
    }
    if(programme && depth===2 && name==="programme"){
      if(!programme.channel||!programme.start||!programme.end||!programme.title)
        throw new Error("Incomplete XMLTV item");
      const start=parseXmltvTime(programme.start);
      const end=parseXmltvTime(programme.end);
      if(start===end){
        // Some upstream guides contain placeholder events with no duration.
        // They cannot be published; skip only these instead of rejecting
        // every valid programme in the same XMLTV feed.
        skippedInvalidDuration++;
      }else{
        results.push(makeProgramme({
          channel:programme.channel,externalId:programme.externalId,
          start,end,title:programme.title,synopsis:programme.synopsis,
          category:programme.category,image:programme.image,
        }));
        if(results.length>MAX_PROGRAMMES)throw new Error("XMLTV programme limit");
      }
      programme=null;
    }
    depth--;
  };
  const decoder=new TextDecoder("utf-8",{fatal:true});
  const chunkSize=64*1024;
  for(let offset=0;offset<data.byteLength;offset+=chunkSize){
    const chunk=decoder.decode(data.subarray(offset,offset+chunkSize),{stream:true});
    sax.write(chunk);
  }
  sax.write(decoder.decode());
  sax.close();
  if(!rootSeen||depth!==0)throw new Error("Invalid XMLTV contents");
  // Programme records never certify whole-day coverage.
  return {programmes:results,coverage:[],skippedInvalidDuration};
}
