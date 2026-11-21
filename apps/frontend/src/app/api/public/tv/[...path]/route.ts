import { NextResponse,type NextRequest } from "next/server";
import { tvPublicEnabled } from "@/lib/tv-public-gate";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic="force-dynamic";
const CLOSED={"cache-control":"no-store","x-robots-tag":"noindex, nofollow"};
type Context={params:Promise<{path:string[]}>};
/** Never proxy a TV request before the two independent release approvals.
 * Only known read-only TV resources may be forwarded; no upstream cookies.
 */
export async function GET(request:NextRequest,{params}:Context){
 if(!tvPublicEnabled())return new NextResponse("Not Found",{status:404,headers:CLOSED});
 const {path}=await params;
 if(!Array.isArray(path)||path.length===0||path.some(x=>!x||x.length>150
    ||x==="."||x===".."||x.includes("/"))){
   return new NextResponse("Not Found",{status:404,headers:CLOSED});
 }
 const allowed=(path.length===1&&["countries","schedule","search"].includes(path[0]!))
  ||(path.length===2&&path[0]==="channels")
  ||(path.length===3&&path[0]==="channels"&&path[2]==="airings")
  ||(path.length===2&&path[0]==="airings");
 if(!allowed)return new NextResponse("Not Found",{status:404,headers:CLOSED});
 const query=request.nextUrl.search;
 if(query.length>2048)return NextResponse.json({message:"TV_INVALID_FILTER"},{status:400,headers:CLOSED});
 try{
  const response=await fetch(getBackendUrl()+"/public/tv/"+path.map(encodeURIComponent).join("/")+
    query,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  const body=await response.text();
  return new NextResponse(body,{status:response.status,headers:{
    ...CLOSED,"content-type":"application/json; charset=utf-8",
  }});
 }catch{
  return NextResponse.json({message:"TV_API_UNAVAILABLE"},{status:503,headers:CLOSED});
 }
}
