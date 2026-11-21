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
   ["EPG source exceeds download size limit","EPG_SIZE_COMPRESSED"],
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
   .toBe("EPG_PROGRAMME_LIMIT");
  expect(classifyEpgFailure(new Error("Incomplete XMLTV item"),"DECODE"))
   .toBe("EPG_XMLTV_ITEM_INVALID");
  expect(classifyEpgFailure(new Error("password=secret connection failed"),"MAPPING"))
   .toBe("EPG_DATABASE_WRITE");
  expect(classifyEpgFailure(new Error("internal.url/token"),"DOWNLOAD"))
   .toBe("EPG_DOWNLOAD_UNEXPECTED");
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
 it("keeps unexpected download errors stage-specific and XML failures distinct",()=>{
  expect(classifyEpgFailure(new Error("unknown https://secret.example/token"),"DOWNLOAD"))
   .toBe("EPG_DOWNLOAD_UNEXPECTED");
  expect(classifyEpgFailure(new Error("Incomplete XMLTV item"),"DECODE"))
   .toBe("EPG_XMLTV_ITEM_INVALID");
  expect(classifyEpgFailure(new Error("XMLTV programme limit"),"DECODE"))
   .toBe("EPG_PROGRAMME_LIMIT");
 });

 it("preserves the sanitized phase identifiers across repeated classification",()=>{
  for(const code of [
   "EPG_DNS_LOOKUP_FAILED",
   "EPG_HTTP_REQUEST_FAILED",
   "EPG_HTTP_TRANSFER_FAILED",
   "EPG_GZIP_PROCESS_FAILED",
  ]){
   expect(EPG_FAILURE_CODES.has(code)).toBe(true);
   expect(classifyEpgFailure(new Error(code),"DOWNLOAD")).toBe(code);
  }
 });
 it("distinguishes exact source, size and decoder stages without leaking details",()=>{
  const cases:[string,"DOWNLOAD"|"DECODE",string][]=[
   ["Invalid EPG source URL","DOWNLOAD","EPG_URL_INVALID"],
   ["EPG source address is not exclusively public IPv4","DOWNLOAD","EPG_DNS_NON_PUBLIC"],
   ["Expanded EPG exceeds size limit","DOWNLOAD","EPG_SIZE_EXPANDED"],
   ["Invalid XMLTV calendar time","DECODE","EPG_XMLTV_TIME_INVALID"],
   ["Invalid XMLTV root","DECODE","EPG_FORMAT_MISMATCH"],
   ["premature close","DOWNLOAD","EPG_STREAM_INTERRUPTED"],
  ];
  for(const [message,stage,expected] of cases){
   const value=classifyEpgFailure(new Error(message),stage);
   expect(value).toBe(expected);
   expect(EPG_FAILURE_CODES.has(value)).toBe(true);
  }
  expect(classifyEpgFailure(new Error("EPG_HTTP_404"),"DOWNLOAD")).toBe("EPG_HTTP_404");
 });

});
