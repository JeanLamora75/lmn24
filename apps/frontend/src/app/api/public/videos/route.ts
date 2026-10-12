import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";
export async function GET(request: Request): Promise<Response> {
  const input=new URL(request.url).searchParams;
  const query=new URLSearchParams();
  for(const key of ["locale","categoryId","sourceId","country","cursor","limit"]){
    const value=input.get(key); if(value!==null)query.set(key,value);
  }
  try{
    const r=await fetch(getBackendUrl()+"/public/videos?"+query,{cache:"no-store"});
    return new NextResponse(await r.text(),{status:r.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return NextResponse.json({message:"Service indisponible."},{status:503});}
}
