/** Private TV logo cache. Writes only beneath apps/frontend/public/tv-icons.
 * Never downloads a URL directly with fetch(): DNS is validated and pinned.
 * PNG/JPEG/WebP only, no SVG (scripts) and no unbounded downloads.
 */
import {createHash} from "node:crypto";
import {lookup} from "node:dns/promises";
import {request as httpRequest} from "node:http";
import {request as httpsRequest} from "node:https";
import {existsSync} from "node:fs";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {isPublicSourceAddress} from "./tv-epg-source-policy";

export const MAX_TV_ICON_BYTES=1_000_000;
function iconDirectory():string{
 const root=process.cwd();
 const sibling=resolve(root,"../frontend/public");
 const publicDir=existsSync(sibling)?sibling:resolve(root,"apps/frontend/public");
 if(!existsSync(publicDir))
  throw new Error("TV_ICON_PUBLIC_DIR_MISSING");
 return join(publicDir,"tv-icons");
}
function extension(buffer:Buffer):"png"|"jpg"|"webp"|null{
 if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "png";
 if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return "jpg";
 if(buffer.length>=12&&buffer.toString("ascii",0,4)==="RIFF"&&
  buffer.toString("ascii",8,12)==="WEBP")return "webp";
 return null;
}
function iconKey(key:string):string{
 return createHash("sha256").update(key).digest("hex");
}
function localName(key:string,ext:string):string{
 return iconKey(key)+"."+ext;
}
export function isLocalTvIcon(url:string|null|undefined):boolean{
 return !!url&&/^\/tv-icons\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(url);
}
async function previouslyStored(key:string):Promise<string|null>{
 const directory=iconDirectory();
 for(const ext of ["png","jpg","webp"]){
  const name=localName(key,ext);
  if(existsSync(join(directory,name)))return "/tv-icons/"+name;
 }
 return null;
}
async function store(key:string,buffer:Buffer,overwrite=false):Promise<string>{
 if(buffer.length===0||buffer.length>MAX_TV_ICON_BYTES)
  throw new Error("TV_ICON_SIZE_INVALID");
 const ext=extension(buffer);
 if(!ext)throw new Error("TV_ICON_FORMAT_INVALID");
 const dir=iconDirectory();
 await mkdir(dir,{recursive:true});
 if(!overwrite){
  const found=await previouslyStored(key);
  if(found)return found;
 }
 const name=localName(key,ext);
 await writeFile(join(dir,name),buffer,{flag:overwrite?"w":"wx"}).catch(async error=>{
  if(!overwrite&&(error as NodeJS.ErrnoException).code==="EEXIST")return;
  throw error;
 });
 return "/tv-icons/"+name;
}
function safeRemote(raw:string):URL{
 const u=new URL(raw);
 if(!["https:","http:"].includes(u.protocol)||u.username||u.password||u.port&&
  !["80","443"].includes(u.port)||!u.hostname||u.href.length>2048)
  throw new Error("TV_ICON_REMOTE_URL_INVALID");
 return u;
}
async function downloadPinned(url:URL,redirects=0):Promise<Buffer>{
 const addresses=await lookup(url.hostname,{all:true,verbatim:true});
 const ipv4=addresses.filter(x=>x.family===4);
 if(!ipv4.length||ipv4.some(x=>!isPublicSourceAddress(x.address)))
  throw new Error("TV_ICON_REMOTE_ADDRESS_BLOCKED");
 const address=ipv4[0]!.address;
 return new Promise((resolvePromise,reject)=>{
  const request=url.protocol==="https:"?httpsRequest:httpRequest;
  const req=request({
   protocol:url.protocol,hostname:address,
   port:url.port?Number(url.port):undefined,
   path:url.pathname+url.search,method:"GET",timeout:8000,
   ...(url.protocol==="https:"?{servername:url.hostname}:{}),
   headers:{host:url.host,accept:"image/png,image/jpeg,image/webp,*/*;q=0.5",
    "user-agent":"LMN24-TV-Logo-Importer/1.0 (https://www.lmn24.com)",
    "accept-encoding":"identity"},
  },res=>{
   if([301,302,303,307,308].includes(res.statusCode??0)){
    const next=res.headers.location;
    res.resume();
    if(!next||redirects>=3){reject(new Error("TV_ICON_REDIRECT_LIMIT"));return;}
    try{
     const target=safeRemote(new URL(next,url).href);
     if(url.protocol==="https:"&&target.protocol!=="https:")
      throw new Error("TV_ICON_UNSAFE_REDIRECT");
     void downloadPinned(target,redirects+1).then(resolvePromise,reject);
    }catch{reject(new Error("TV_ICON_UNSAFE_REDIRECT"));}
    return;
   }
   if(res.statusCode!==200){
    const status=res.statusCode??0;
    res.resume();
    reject(new Error(status===403?"TV_ICON_HTTP_403":
     status===404?"TV_ICON_HTTP_404":status===429?"TV_ICON_HTTP_429":
     "TV_ICON_HTTP_ERROR"));
    return;
   }
   if(String(res.headers["content-encoding"]??"identity")!=="identity"){
    res.resume();reject(new Error("TV_ICON_ENCODING_INVALID"));return;
   }
   let size=0;const chunks:Buffer[]=[];
   res.on("data",(chunk:Buffer)=>{
    size+=chunk.length;
    if(size>MAX_TV_ICON_BYTES){req.destroy(new Error("TV_ICON_TOO_LARGE"));return;}
    chunks.push(chunk);
   });
   res.on("end",()=>resolvePromise(Buffer.concat(chunks,size)));
   res.on("aborted",()=>reject(new Error("TV_ICON_TRANSFER_FAILED")));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(new Error("TV_ICON_TIMEOUT")));
  req.on("error",reject);
  req.end();
 });
}
/** Cached per original URL to avoid fetching the same logo on repeat imports.
 * The existing valid local file is returned before any network operation.
 */
export async function cacheTvIcon(remoteUrl:string):Promise<string|null>{
 try{
  const url=safeRemote(remoteUrl);
  const key="remote:"+url.href;
  const existing=await previouslyStored(key);
  if(existing)return existing;
  const data=await downloadPinned(url);
  return await store(key,data);
 }catch{return null;} // A broken logo must not fail the entire TV import.
}
/** Explicit administration import returns a bounded error code rather than silently
 * swallowing remote HTTP/transfer errors (normal EPG imports remain best effort).
 */
export async function importTvIconFromUrl(remoteUrl:string):Promise<string>{
 let url:URL;
 try{url=safeRemote(remoteUrl);}
 catch{throw new Error("TV_ICON_REMOTE_URL_INVALID");}
 const key="remote:"+url.href;
 const existing=await previouslyStored(key);
 if(existing)return existing;
 const data=await downloadPinned(url);
 return store(key,data);
}
/** Admin upload: independent of provider cache, so replacing a logo is explicit.
 * A fresh URL is used for each content revision (cache-safe, immutable asset).
 */
export async function saveUploadedTvIcon(channelId:string,bytes:Buffer):Promise<string>{
 const key="manual:"+channelId+":"+createHash("sha256").update(bytes).digest("hex");
 return store(key,bytes);
}
export function validateUploadedIcon(base64:string):Buffer{
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
  throw new Error("TV_ICON_ENCODING_INVALID");
 const bytes=Buffer.from(base64,"base64");
 if(!extension(bytes)||bytes.length===0||bytes.length>MAX_TV_ICON_BYTES)
  throw new Error("TV_ICON_FORMAT_OR_SIZE_INVALID");
 return bytes;
}
