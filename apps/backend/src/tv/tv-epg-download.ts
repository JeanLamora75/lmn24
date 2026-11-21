import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import {classifyEpgFailure} from "./tv-epg-failure";
import {assertSafeXmltvDeclarations} from "./tv-xmltv-doctype";
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
  // Resolve and validate each host before connecting to its pinned public IPv4.
  // Use the IP for the socket but retain the original hostname for HTTPS SNI,
  // certificate verification and Host: this avoids custom DNS lookup issues.
  let current=validateEpgSourceUrl(rawUrl);
  let compressed:Buffer|undefined;
  for(let redirects=0;redirects<=EPG_FETCH_LIMITS.maxRedirects;redirects++){
    const answers=await lookup(current.hostname,{all:true,verbatim:true})
      .catch(error=>{throw safePhaseError(error,"EPG_DNS_LOOKUP_FAILED");});
    const publicIPv4=answers.find(a=>a.family===4&&isPublicSourceAddress(a.address));
    // Only IPv4 is used by the pinned socket. Ignore AAAA records safely:
    // an unused public IPv6 must not prevent fetching from a dual-stack CDN.
    if(!publicIPv4 || answers.some(a=>a.family===4&&!isPublicSourceAddress(a.address)))
      throw new Error("EPG_DNS_NON_PUBLIC");
    const request=current.protocol==="https:"?httpsRequest:httpRequest;
    const response=await new Promise<{status:number;location?:string;body?:Buffer}>((resolve,reject)=>{
      const req=request({
        protocol:current.protocol,hostname:publicIPv4.address,
        port:current.port?Number(current.port):undefined,
        path:current.pathname+current.search,
        method:"GET",timeout:EPG_FETCH_LIMITS.timeoutMs,
        // TLS verifies the original public domain, never the pinned IP.
        ...(current.protocol==="https:"?{servername:current.hostname}:{}),
        headers:{host:current.host,accept:"application/xml,application/json,application/octet-stream",
          "accept-encoding":"identity"},
      },res=>{
        const status=res.statusCode??0;
        if([301,302,303,307,308].includes(status)){
          const location=res.headers.location;
          res.resume();
          resolve(location?{status,location}:{status});return;
        }
        if(status!==200){res.resume();reject(new Error("EPG source returned HTTP "+status));return;}
        const encoding=String(res.headers["content-encoding"]??"identity").toLowerCase();
        if(encoding!=="identity"){res.resume();reject(new Error("Unexpected content encoding"));return;}
        const chunks:Buffer[]=[];let total=0;
        res.on("aborted",()=>reject(new Error("EPG_HTTP_TRANSFER_FAILED")));
        res.on("data",(part:Buffer)=>{
          total+=part.length;
          if(total>EPG_FETCH_LIMITS.maxCompressedBytes){
            req.destroy(new Error("EPG source exceeds download size limit"));return;
          }
          chunks.push(part);
        });
        res.on("end",()=>resolve({status,body:Buffer.concat(chunks,total)}));
        res.on("error",error=>reject(safePhaseError(error,"EPG_HTTP_TRANSFER_FAILED")));
      });
      req.on("timeout",()=>req.destroy(new Error("EPG source request timed out")));
      req.on("error",reject);
      req.end();
    }).catch(error=>{throw safePhaseError(error,"EPG_HTTP_REQUEST_FAILED");});
    if(response.body){compressed=response.body;break;}
    if(!response.location||redirects===EPG_FETCH_LIMITS.maxRedirects)
      throw new Error("EPG_HTTP_REDIRECT");
    const next=validateEpgSourceUrl(new URL(response.location,current).toString());
    // Never downgrade a secure source or send credentials to redirect targets.
    if(current.protocol==="https:"&&next.protocol!=="https:")
      throw new Error("EPG_HTTP_REDIRECT");
    current=next;
  }
  if(!compressed)throw new Error("EPG_HTTP_REDIRECT");
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
    // Only approved inert XMLTV DTD identifiers are accepted; no external resolution.
    assertSafeXmltvDeclarations(expanded.toString("utf8"));
    if(!prefix.trimStart().startsWith("<?xml")&&!prefix.trimStart().startsWith("<tv"))
      throw new Error("Invalid XMLTV document");
  }else{
    // Validates strict JSON before ingestion, without executing any embedded data.
    try{JSON.parse(expanded.toString("utf8"));}
    catch{throw new Error("EPG_JSON_INVALID");}
  }
  return expanded;
}
