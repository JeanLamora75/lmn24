import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";
type Context={params:Promise<{segments:string[]}>};
export async function GET(request:Request,{params}:Context) {return forward(request,await params,"GET");}
export async function POST(request:Request,{params}:Context) {return forward(request,await params,"POST");}
async function forward(request:Request,{segments}: {segments:string[]} ,method:"GET"|"POST") {
  const route=segments.join("/");
  const permitted=method==="GET"
    ? /^(overview|history|files|preview\/horoscopes-\d{4}-\d{2}-\d{2}\.json\/(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/(fr|en|de|es|it|pt|ru|nl))$/
    : /^(upload|files\/horoscopes-\d{4}-\d{2}-\d{2}\.json\/import)$/;
  if(!permitted.test(route))return NextResponse.json({message:"Route invalide."},{status:404});
  try{
    const headers:Record<string,string>={cookie:request.headers.get("cookie")??""};
    const origin=request.headers.get("origin");
    if(method==="POST"){
      // Backend expects a browser Origin. Forward it without forging one.
      if(origin)headers.origin=origin;
      headers["content-type"]="application/json";
    }
    const response=await fetch(getBackendUrl()+"/admin/horoscopes/"+route,{
      method,headers,body:method==="POST"?await request.text():undefined,cache:"no-store",
    });
    return new NextResponse(await response.text(),{status:response.status,
      headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return NextResponse.json({message:"Import Horoscope indisponible."},{status:503});}
}
