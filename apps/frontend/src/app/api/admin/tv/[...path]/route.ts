import {NextResponse,type NextRequest} from "next/server";
import {proxyAdminBackend} from "@/lib/admin-backend";

export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
const patterns=[
 /^catalog\/(?:countries|channels)$/,
 /^catalog\/countries\/[0-9a-f-]{36}$/i,
 /^catalog\/channels\/discover$/,
 /^catalog\/associations\/[0-9a-f-]{36}$/i,
 /^catalog\/associations\/[0-9a-f-]{36}\/assign-number$/i,
 /^catalog\/channels\/[0-9a-f-]{36}\/(?:profile|languages|icon)$/i,
 /^catalog\/variants$/,
 /^epg-sources$/,
 /^epg-sources\/discoveries$/,
 /^epg-sources\/discoveries\/import$/,
 /^epg-sources\/[0-9a-f-]{36}\/(?:configuration|rights|mappings|test-connection)$/i,
 /^epg-sources\/countries\/[0-9a-f-]{36}\/priorities$/i,
 /^epg-sources\/mappings(?:\/[0-9a-f-]{36})?$/i,
 /^translations\/providers$/,
 /^translations\/channels\/[0-9a-f-]{36}\/(?:statuses|preview|approve)$/i,
 /^translations\/providers\/[0-9a-f-]{36}\/select$/i,
 /^translations\/channels\/[0-9a-f-]{36}\/descriptions(?:\/(?:fr|en|de|es|pt|it|ru|nl))?$/i,
 /^import-runs$/,
 /^import-runs\/execution-status$/,
 /^import-runs\/[0-9a-f-]{36}(?:\/(?:events|retry|execute))?$/i,
];
async function handle(request:NextRequest,context:Context,method:"GET"|"POST"|"PUT"|"PATCH"|"DELETE"){
 const {path}=await context.params;
 const route=path?.join("/")??"";
 if(!patterns.some(pattern=>pattern.test(route))||request.nextUrl.search.length>1500)
  return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
 // Allow only already authenticated, role-authorized NestJS operations. No
 // arbitrary path or public-TV operation can be reached through this proxy.
 const body=method==="GET"?undefined:await request.text();
 if(body&&body.length>(/\/icon$/.test(route)?1_400_100:100_000))
  return NextResponse.json({message:"Payload too large"},{status:413,headers:{"cache-control":"no-store"}});
 return proxyAdminBackend(request,"/admin/tv/"+route+request.nextUrl.search,{
  method,headers:body===undefined?{}:{"content-type":"application/json"},body:body??null,
 });
}
export const GET=(request:NextRequest,context:Context)=>handle(request,context,"GET");
export const POST=(request:NextRequest,context:Context)=>handle(request,context,"POST");
export const PUT=(request:NextRequest,context:Context)=>handle(request,context,"PUT");
export const PATCH=(request:NextRequest,context:Context)=>handle(request,context,"PATCH");
export const DELETE=(request:NextRequest,context:Context)=>handle(request,context,"DELETE");
