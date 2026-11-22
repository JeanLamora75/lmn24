import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {request as httpsRequest} from "node:https";
import {isPublicSourceAddress,validateEpgSourceUrl} from "./tv-epg-source-policy";
import {xmltvHttpUrl} from "./tv-epg-decoder";

/** Upgrade HTTP programme artwork to HTTPS only after a successful
 * TLS-verified image response. An unavailable HTTPS endpoint keeps the HTTP URL.
 * Probe is bounded, DNS-pinned and rejects non-public hosts (SSRF protection).
 */
export type HttpsImageProbe=(url:string)=>Promise<boolean>;
export async function probeHttpsProgrammeImage(raw:string):Promise<boolean>{
 try{
  const url=validateEpgSourceUrl(raw);
  if(url.protocol!=="https:")return false;
  const addresses=await lookup(url.hostname,{all:true,verbatim:true});
  const v4=addresses.find(a=>a.family===4&&isPublicSourceAddress(a.address));
  if(!v4||addresses.some(a=>!isPublicSourceAddress(a.address)))return false;
  const inspect=(method:"HEAD"|"GET")=>new Promise<number>((resolve)=>{
   const req=httpsRequest({
    hostname:v4.address,servername:url.hostname,path:url.pathname+url.search,
    method,timeout:2000,headers:{
     host:url.host,accept:"image/*",
     ...(method==="GET"?{range:"bytes=0-0"}:{}),
    },
   },response=>{
    const code=response.statusCode??0;
    const type=String(response.headers["content-type"]??"").toLowerCase();
    // Do not follow redirects or accept HTML masquerading as an image.
    const valid=(code===200||code===206)&&type.startsWith("image/");
    response.destroy();
    resolve(valid?200:code===405&&method==="HEAD"?405:0);
   });
   req.on("timeout",()=>req.destroy());
   req.on("error",()=>resolve(0));
   req.end();
  });
  const head=await inspect("HEAD");
  return head===200||(await inspect("GET"))===200;
 }catch{return false;}
}
export function makeProgrammeImageResolver(
 probe:HttpsImageProbe=probeHttpsProgrammeImage,
 maxConcurrent=6,
){
 const cache=new Map<string,Promise<string|null>>();
 let running=0;
 const queue:Array<()=>void>=[];
 async function inPool<T>(action:()=>Promise<T>):Promise<T>{
  if(running>=maxConcurrent)await new Promise<void>(resolve=>queue.push(resolve));
  running++;
  try{return await action();}
  finally{running--;queue.shift()?.();}
 }
 return (raw:string|null):Promise<string|null>=>{
  if(!raw)return Promise.resolve(null);
  const valid=xmltvHttpUrl(raw,true);
  if(!valid)return Promise.resolve(null);
  const host=new URL(valid).hostname.toLowerCase();
  // Do not introduce local-network image requests from untrusted XMLTV feeds.
  if(isIP(host)||host==="localhost"||host.endsWith(".localhost")
    ||host.endsWith(".local")||host.endsWith(".internal"))return Promise.resolve(null);
  if(valid.startsWith("https://"))return Promise.resolve(valid);
  const existing=cache.get(valid);
  if(existing)return existing;
  const result=inPool(async()=>{
   const secure="https://"+valid.slice("http://".length);
   return await probe(secure)?secure:valid;
  });
  cache.set(valid,result);
  return result;
 };
}
