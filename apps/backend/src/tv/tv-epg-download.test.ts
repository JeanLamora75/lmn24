import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {describe,expect,it,vi} from "vitest";

const fake=vi.hoisted(()=>({
 lookup:vi.fn(),
 request:vi.fn(),
}));
vi.mock("node:dns/promises",()=>({lookup:fake.lookup}));
vi.mock("node:https",()=>({request:fake.request}));
import {downloadEpgSource} from "./tv-epg-download";

describe("Pinned EPG IPv4 transport",()=>{
 it("disables automatic address-family selection while preserving DNS validation and TLS hostname",async()=>{
  fake.lookup.mockResolvedValueOnce([{address:"1.1.1.1",family:4}]);
  fake.request.mockImplementationOnce((url:URL,options:Record<string,unknown>,
   callback:(response:PassThrough & {statusCode:number;headers:Record<string,string>})=>void)=>{
    const req=new EventEmitter() as EventEmitter & {end:()=>void;destroy:(error?:Error)=>void};
    req.end=()=>{
      const res=Object.assign(new PassThrough(),{statusCode:200,headers:{}});
      callback(res);
      res.end('<?xml version="1.0"?><tv></tv>');
    };
    req.destroy=(error?:Error)=>{if(error)req.emit("error",error);};
    return req;
  });
  const result=await downloadEpgSource("https://example.org/guide.xml","XMLTV");
  expect(result.toString("utf8")).toContain("<tv>");
  const [url,options]=fake.request.mock.calls[0] as [URL,Record<string,unknown>];
  expect(url.hostname).toBe("example.org");
  expect(options.family).toBe(4);
  expect(options.autoSelectFamily).toBe(false);
  expect(typeof options.lookup).toBe("function");
  const pinned=await new Promise<{address:string;family:number}>((resolve,reject)=>{
    const lookup=options.lookup as (hostname:string,options:object,
      callback:(error:Error|null,address:string,family:number)=>void)=>void;
    lookup("example.org",{},(error,address,family)=>{
      if(error)reject(error);else resolve({address,family});
    });
  });
  expect(pinned).toEqual({address:"1.1.1.1",family:4});
 });
});
