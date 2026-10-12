import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";
export async function GET(request:Request):Promise<Response>{
  const locale=new URL(request.url).searchParams.get("locale")??"";
  try{const r=await fetch(getBackendUrl()+"/public/videos/filters?locale="+encodeURIComponent(locale),{cache:"no-store"});
    return new NextResponse(await r.text(),{status:r.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return NextResponse.json({message:"Service indisponible."},{status:503});}
}
