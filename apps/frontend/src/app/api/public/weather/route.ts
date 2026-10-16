import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";
import { isWeatherRegion } from "@/components/weather/weather-data";

/** Safe same-origin browser refresh proxy. Open-Meteo is never called here. */
export async function GET(request:Request):Promise<Response>{
  const input=new URL(request.url).searchParams;
  const continent=input.get("continent")??"EU";
  if(!isWeatherRegion(continent) || [...input.keys()].some(key=>key!=="continent") ||
    input.getAll("continent").length>1) {
    return NextResponse.json({message:"Invalid weather continent."},{status:400,
      headers:{"cache-control":"no-store"}});
  }
  try {
    const url=getBackendUrl()+"/weather?continent="+encodeURIComponent(continent);
    const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(8000)});
    const body=await response.text();
    return new NextResponse(body,{status:response.status,headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":response.ok?"public, max-age=30, stale-while-revalidate=30":"no-store",
    }});
  }catch{
    return NextResponse.json({message:"Weather service unavailable."},{status:503,
      headers:{"cache-control":"no-store"}});
  }
}
