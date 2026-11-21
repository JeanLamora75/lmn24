import {describe,expect,it} from "vitest";
import {selectXmltvLogos} from "./tv-logo-policy";

describe("XMLTV shared-logo safety policy",()=>{
 const placeholder="https://focus.example.org/0000/00/01/clear-192.png";
 it("rejects a repeated generic placeholder from three different channels",()=>{
  const entries=["13ème Rue","20 Minutes TV","2M Maroc"].map((name,i)=>({
   externalId:"c"+i,name,logoUrl:placeholder,
  }));
  const result=selectXmltvLogos(entries);
  expect(result.rejected.has(placeholder)).toBe(true);
  expect(result.chosen.size).toBe(0);
 });
 it("uses a different non-generic icon when provided",()=>{
  const second="https://example.org/13eme-rue.png";
  const entries=["13ème Rue","20 Minutes TV","2M Maroc"].map((name,i)=>({
   externalId:"c"+i,name,logoUrl:placeholder,
   logoUrls:i===0?[placeholder,second]:[placeholder],
  }));
  const result=selectXmltvLogos(entries);
  expect(result.rejected.has(placeholder)).toBe(true);
  expect(result.chosen.get("c0")).toBe(second);
 });
 it("does not reject genuinely shared broadcaster logos",()=>{
  const logo="https://example.org/TF1.png";
  const result=selectXmltvLogos(["TF1","TF1 +1","TF1 HD"].map((name,i)=>({
   externalId:"c"+i,name,logoUrl:logo,
  })));
  expect(result.rejected.size).toBe(0);
  expect(result.chosen.size).toBe(3);
 });
 it("does not penalize an individual generic-name image or a duplicated channel entry",()=>{
  const result=selectXmltvLogos([
   {externalId:"c1",name:"One",logoUrl:placeholder},
   {externalId:"c1",name:"One",logoUrl:placeholder},
  ]);
  expect(result.rejected.size).toBe(0);
  expect(result.chosen.get("c1")).toBe(placeholder);
 });
});
