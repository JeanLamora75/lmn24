import {describe,expect,it,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";

vi.mock("@/lib/admin-backend",()=>({
 proxyAdminBackend:vi.fn(async()=>NextResponse.json({ok:true})),
}));
import {proxyAdminBackend} from "@/lib/admin-backend";
import {GET,POST} from "./route";
const id="47acdcfe-1aa1-4d45-afca-599040d34a42";
const context=(path:string[])=>({params:Promise.resolve({path})});
describe("TV admin channel edit proxy allowlist",()=>{
 it("permits fetching one channel association",async()=>{
  const res=await GET(new NextRequest("http://localhost:3000/api/admin/tv/catalog/channels/associations/"+id),
   context(["catalog","channels","associations",id]));
  expect(res.status).toBe(200);
  expect(proxyAdminBackend).toHaveBeenCalledWith(expect.anything(),
   "/admin/tv/catalog/channels/associations/"+id,expect.objectContaining({method:"GET"}));
 });
 it("permits secure logo URL import",async()=>{
  const res=await POST(new NextRequest("http://localhost:3000/api/admin/tv/catalog/channels/"+id+"/icon/import",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({url:"https://example.org/image.png"}),
  }),context(["catalog","channels",id,"icon","import"]));
  expect(res.status).toBe(200);
 });
 it("blocks unrelated arbitrary paths",async()=>{
  const res=await GET(new NextRequest("http://localhost:3000/api/admin/tv/catalog/channels/"+id+"/secret"),
   context(["catalog","channels",id,"secret"]));
  expect(res.status).toBe(404);
 });
});
