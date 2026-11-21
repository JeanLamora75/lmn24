import {describe,expect,it} from "vitest";
import {classifyEpgFailure,EPG_FAILURE_CODES} from "./tv-epg-failure";
describe("EPG import error diagnostics (no secrets leak)",()=>{
 it("classifies upstream HTTP, redirects, size and timeout failures",()=>{
  const inputs:[string,string][]=[
   ["EPG source returned HTTP 404","EPG_HTTP_404"],
   ["EPG source returned HTTP 403","EPG_HTTP_403"],
   ["EPG source returned HTTP 429","EPG_HTTP_429"],
   ["EPG source returned HTTP 503","EPG_HTTP_5XX"],
   ["EPG source returned HTTP 302","EPG_HTTP_REDIRECT"],
   ["EPG source exceeds download size limit","EPG_SIZE_LIMIT"],
   ["EPG source request timed out","EPG_TIMEOUT"],
   ["getaddrinfo ENOTFOUND secret.example.org","EPG_DNS_ERROR"],
  ];
  for(const [message,code] of inputs){
   const actual=classifyEpgFailure(new Error(message),"DOWNLOAD");
   expect(actual).toBe(code);
   expect(EPG_FAILURE_CODES.has(actual)).toBe(true);
   expect(actual).not.toMatch(/https?|secret|example/i);
  }
 });
 it("classifies invalid XMLTV and database mapping failures without exposing SQL or credentials",()=>{
  expect(classifyEpgFailure(new Error("XMLTV programme limit"),"DECODE"))
   .toBe("EPG_SIZE_LIMIT");
  expect(classifyEpgFailure(new Error("Incomplete XMLTV item"),"DECODE"))
   .toBe("EPG_XMLTV_INVALID");
  expect(classifyEpgFailure(new Error("password=secret connection failed"),"MAPPING"))
   .toBe("EPG_DATABASE_WRITE");
  expect(classifyEpgFailure(new Error("internal.url/token"),"DOWNLOAD"))
   .toBe("EPG_SOURCE_UNAVAILABLE");
 });
});
