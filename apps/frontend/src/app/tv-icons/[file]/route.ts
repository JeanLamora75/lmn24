import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
export const runtime="nodejs";
type Context={params:Promise<{file:string}>};
export async function GET(_request:Request,context:Context){
 const {file}=await context.params;
 const match=/^[a-f0-9]{64}\.(png|jpg|webp)$/.exec(file);
 if(!match)return new NextResponse("Not Found",{status:404});
 const publicDir=resolve(process.cwd(),"public","tv-icons");
 try{
  const bytes=await readFile(join(publicDir,file));
  const contentType=match[1]==="png"?"image/png":match[1]==="jpg"?"image/jpeg":"image/webp";
  return new NextResponse(new Uint8Array(bytes),{
   status:200,headers:{"Content-Type":contentType,
    "Cache-Control":"public, max-age=31536000, immutable",
    "X-Content-Type-Options":"nosniff"},
  });
 }catch{return new NextResponse("Not Found",{status:404});}
}
