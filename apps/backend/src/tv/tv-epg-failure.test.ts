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
   expect(actual).not.toMatch(/:\/\/|secret|example/i);
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
 it("distinguishes TLS, connection, compression and HTTP encoding without leaking upstream data",()=>{
  const cases:[Error,"DOWNLOAD"|"DECODE",string][]=[
   [Object.assign(new Error("request failed for https://secret.example/token"),{code:"ECONNRESET"}),"DOWNLOAD","EPG_CONNECTION_ERROR"],
   [Object.assign(new Error("socket hang up"),{code:"ECONNRESET"}),"DOWNLOAD","EPG_CONNECTION_ERROR"],
   [Object.assign(new Error("certificate has expired"),{code:"CERT_HAS_EXPIRED"}),"DOWNLOAD","EPG_TLS_ERROR"],
   [new Error("incorrect header check"),"DOWNLOAD","EPG_GZIP_INVALID"],
   [new Error("unexpected end of file"),"DOWNLOAD","EPG_GZIP_INVALID"],
   [new Error("Unexpected content encoding"),"DOWNLOAD","EPG_CONTENT_ENCODING_INVALID"],
   [Object.assign(new Error("upstream TLS error"),{cause:Object.assign(new Error("private"),{code:"UNABLE_TO_VERIFY_LEAF_SIGNATURE"})}),"DOWNLOAD","EPG_TLS_ERROR"],
  ];
  for(const [error,stage,expected] of cases){
   const actual=classifyEpgFailure(error,stage);
   expect(actual).toBe(expected);
   expect(EPG_FAILURE_CODES.has(actual)).toBe(true);
   expect(actual).not.toMatch(/https:|secret|token|private/);
  }
 });
 it("keeps unknown transport failures generic and XML failures distinct",()=>{
  expect(classifyEpgFailure(new Error("unknown https://secret.example/token"),"DOWNLOAD"))
   .toBe("EPG_SOURCE_UNAVAILABLE");
  expect(classifyEpgFailure(new Error("Incomplete XMLTV item"),"DECODE"))
   .toBe("EPG_XMLTV_INVALID");
  expect(classifyEpgFailure(new Error("XMLTV programme limit"),"DECODE"))
   .toBe("EPG_SIZE_LIMIT");
 });

});
