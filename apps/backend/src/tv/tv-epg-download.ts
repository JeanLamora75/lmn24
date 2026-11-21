import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import {classifyEpgFailure} from "./tv-epg-failure";
import { createGunzip } from "node:zlib";
import {
  EPG_FETCH_LIMITS, isPublicSourceAddress, validateEpgSourceUrl, type EpgFormat,
} from "./tv-epg-source-policy";

/** Only reviewed error codes cross into admin history. Exception messages can
 * contain URLs, query tokens or upstream content, so never propagate raw errors.
 */
function safePhaseError(error:unknown,otherwise:string):Error {
  const code=classifyEpgFailure(error,"DOWNLOAD");
  return new Error(code==="EPG_DOWNLOAD_UNEXPECTED"?otherwise:code);
}

/** SSRF-safe fetch: DNS address validated AND pinned to the outgoing socket.
 * Redirects disabled. Never log URLs (potential secrets). No fetch on import.
 * This function is deliberately not exposed via HTTP until SCRUM-117.
 */
export async function downloadEpgSource(rawUrl:string,format:EpgFormat):Promise<Buffer> {
  const url=validateEpgSourceUrl(rawUrl);
  const answers=await lookup(url.hostname,{all:true,verbatim:true})
    .catch(error=>{throw safePhaseError(error,"EPG_DNS_LOOKUP_FAILED");});
  const publicIPv4=answers.find(a=>a.family===4 && isPublicSourceAddress(a.address));
  if(!publicIPv4 || answers.some(a=>!isPublicSourceAddress(a.address)))
    throw new Error("EPG source address is not exclusively public IPv4");
  const request=url.protocol==="https:"?httpsRequest:httpRequest;
  const compressed=await new Promise<Buffer>((resolve,reject)=>{
    const req=request(url,{
      method:"GET",timeout:EPG_FETCH_LIMITS.timeoutMs,
      // A single prevalidated public IPv4 is pinned to the socket. In Node 20+
      // automatic family selection may request an array from custom DNS lookup;
      // disabling it avoids treating the single pinned address as an array.
      family:4,autoSelectFamily:false,
      headers:{"accept":"application/xml,application/json,application/octet-stream","accept-encoding":"identity"},
      lookup:(_hostname,_options,callback)=>callback(null,publicIPv4.address,4),
    },res=>{
      res.on("aborted",()=>reject(new Error("EPG_HTTP_TRANSFER_FAILED")));
      const status=res.statusCode??0;
      if(status!==200){res.resume();reject(new Error("EPG source returned HTTP "+status));return;}
      const encoding=String(res.headers["content-encoding"]??"identity").toLowerCase();
      if(encoding!=="identity"){res.destroy();reject(new Error("Unexpected content encoding"));return;}
      const chunks:Buffer[]=[];
      let total=0;
      res.on("data",(chunk:Buffer)=>{
        total+=chunk.length;
        if(total>EPG_FETCH_LIMITS.maxCompressedBytes){
          req.destroy(new Error("EPG source exceeds download size limit"));return;
        }
        chunks.push(chunk);
      });
      res.on("end",()=>resolve(Buffer.concat(chunks,total)));
      res.on("error",error=>reject(safePhaseError(error,"EPG_HTTP_TRANSFER_FAILED")));
    });
    req.on("timeout",()=>req.destroy(new Error("EPG source request timed out")));
    req.on("error",reject);
    req.end();
  }).catch(error=>{throw safePhaseError(error,"EPG_HTTP_REQUEST_FAILED");});
  let expanded:Buffer;
  if(format==="XMLTV_GZIP"){
    const gunzip=Readable.from([compressed]).pipe(createGunzip());
    const chunks:Buffer[]=[];let total=0;
    try{
      for await (const part of gunzip){
        const chunk=Buffer.from(part as Buffer);
        total+=chunk.length;
        if(total>EPG_FETCH_LIMITS.maxExpandedBytes){
          gunzip.destroy(new Error("Expanded EPG exceeds size limit"));
          throw new Error("Expanded EPG exceeds size limit");
        }
        chunks.push(chunk);
      }
    }catch(error){throw safePhaseError(error,"EPG_GZIP_PROCESS_FAILED");}
    finally{gunzip.destroy();}
    expanded=Buffer.concat(chunks,total);
  }else{
    expanded=compressed;
  }
  if(expanded.length>EPG_FETCH_LIMITS.maxExpandedBytes)
    throw new Error("Expanded EPG exceeds size limit");
  if(format==="XMLTV"||format==="XMLTV_GZIP"){
    const prefix=expanded.subarray(0,Math.min(expanded.length,2048)).toString("utf8");
    if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(expanded.toString("utf8")))
      throw new Error("External XML entities and document types are prohibited");
    if(!prefix.trimStart().startsWith("<?xml")&&!prefix.trimStart().startsWith("<tv"))
      throw new Error("Invalid XMLTV document");
  }else{
    // Validates strict JSON before ingestion, without executing any embedded data.
    JSON.parse(expanded.toString("utf8"));
  }
  return expanded;
}
