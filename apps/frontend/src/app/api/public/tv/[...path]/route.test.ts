import {afterEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "./route";

const before={enabled:process.env.TV_PUBLIC_ENABLED,approved:process.env.TV_PUBLIC_RELEASE_APPROVED};
afterEach(()=>{
 vi.unstubAllGlobals();
 if(before.enabled===undefined)delete process.env.TV_PUBLIC_ENABLED;
 else process.env.TV_PUBLIC_ENABLED=before.enabled;
 if(before.approved===undefined)delete process.env.TV_PUBLIC_RELEASE_APPROVED;
 else process.env.TV_PUBLIC_RELEASE_APPROVED=before.approved;
});
describe("SCRUM-124 Next.js TV API HTTP embargo",()=>{
 it.each([
  [undefined,undefined],[undefined,"true"],["true",undefined],["TRUE","true"],
  ["true","false"],["false","true"],
 ])("rejects unsafe release flags %s/%s and never fetches upstream",async(enabled,approved)=>{
  if(enabled===undefined)delete process.env.TV_PUBLIC_ENABLED;else process.env.TV_PUBLIC_ENABLED=enabled;
  if(approved===undefined)delete process.env.TV_PUBLIC_RELEASE_APPROVED;else process.env.TV_PUBLIC_RELEASE_APPROVED=approved;
  const upstream=vi.fn();vi.stubGlobal("fetch",upstream);
  const request=new NextRequest("https://www.lmn24.com/api/public/tv/search?q=2");
  const result=await GET(request,{params:Promise.resolve({path:["search"]})});
  expect(result.status).toBe(404);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(result.headers.get("x-robots-tag")).toContain("noindex");
  expect(await result.text()).not.toContain("channel");
  expect(upstream).not.toHaveBeenCalled();
 });
 it("does not publish TV fields through the fallback after a disabled gate",async()=>{
  process.env.TV_PUBLIC_ENABLED="false";process.env.TV_PUBLIC_RELEASE_APPROVED="true";
  const r=await GET(new NextRequest("http://127.0.0.1:3000/api/public/tv/countries"),{
   params:Promise.resolve({path:["countries"]}),
  });
  expect(r.status).toBe(404);
  expect(r.headers.get("cache-control")).toBe("no-store");
 });
});
