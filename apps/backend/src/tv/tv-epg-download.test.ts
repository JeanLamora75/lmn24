import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {describe,expect,it,vi,beforeEach} from "vitest";

const fake=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock("node:dns/promises",()=>({lookup:fake.lookup}));
vi.mock("node:https",()=>({request:fake.request}));
import {downloadEpgSource} from "./tv-epg-download";

type Response=PassThrough&{statusCode:number;headers:Record<string,string>};
function respond(status:number,body:string,headers:Record<string,string>={}){
 fake.request.mockImplementationOnce((
  options:Record<string,unknown>,callback:(response:Response)=>void)=>{
  const req=new EventEmitter() as EventEmitter&{end:()=>void;destroy:(error?:Error)=>void};
  req.end=()=>{
   const res=Object.assign(new PassThrough(),{statusCode:status,headers});
   callback(res);
   res.end(body);
  };
  req.destroy=(error?:Error)=>{if(error)req.emit("error",error);};
  return req;
 });
}
describe("Safe pinned IPv4 EPG download",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("downloads XML over the vetted IP with correct TLS hostname, without custom DNS lookup",async()=>{
  fake.lookup.mockResolvedValueOnce([{address:"1.1.1.1",family:4},
   {address:"2606:4700:4700::1111",family:6}]);
  respond(200,'<?xml version="1.0"?><tv></tv>');
  const result=await downloadEpgSource("https://example.org/guide.xml","XMLTV");
  expect(result.toString("utf8")).toContain("<tv>");
  const options=fake.request.mock.calls[0]?.[0] as Record<string,unknown>;
  expect(options).toMatchObject({
   protocol:"https:",hostname:"1.1.1.1",servername:"example.org",
   path:"/guide.xml",method:"GET",
  });
  expect(options.lookup).toBeUndefined();
  expect((options.headers as Record<string,string>).host).toBe("example.org");
 });
 it("follows an HTTPS redirect only after independently validating the new public host",async()=>{
  fake.lookup.mockResolvedValueOnce([{address:"1.1.1.1",family:4}])
   .mockResolvedValueOnce([{address:"8.8.8.8",family:4}]);
  respond(302,"",{location:"https://cdn.example.org/epg.xml"});
  respond(200,"<tv></tv>");
  await expect(downloadEpgSource("https://example.org/index","XMLTV"))
   .resolves.toEqual(Buffer.from("<tv></tv>"));
  expect(fake.lookup).toHaveBeenCalledTimes(2);
  const next=fake.request.mock.calls[1]?.[0] as Record<string,unknown>;
  expect(next.hostname).toBe("8.8.8.8");
  expect(next.servername).toBe("cdn.example.org");
 });
 it("refuses a redirect into a private host before making a second request",async()=>{
  fake.lookup.mockResolvedValueOnce([{address:"1.1.1.1",family:4}])
   .mockResolvedValueOnce([{address:"127.0.0.1",family:4}]);
  respond(302,"",{location:"https://private.example.org/secret"});
  await expect(downloadEpgSource("https://example.org/index","XMLTV"))
   .rejects.toThrow("EPG_DNS_NON_PUBLIC");
  expect(fake.request).toHaveBeenCalledTimes(1);
 });
 it("refuses HTTPS-to-HTTP downgrade",async()=>{
  fake.lookup.mockResolvedValueOnce([{address:"1.1.1.1",family:4}]);
  respond(302,"",{location:"http://example.org/guide.xml"});
  await expect(downloadEpgSource("https://example.org/index","XMLTV"))
   .rejects.toThrow("EPG_HTTP_REDIRECT");
  expect(fake.request).toHaveBeenCalledTimes(1);
 });
});
