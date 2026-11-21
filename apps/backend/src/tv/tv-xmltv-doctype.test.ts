import {describe,expect,it} from "vitest";
import {assertSafeXmltvDeclarations,isAllowedXmltvDoctype} from "./tv-xmltv-doctype";

describe("inert XMLTV DTD allowlist",()=>{
 const accepted=[
  '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
  '<!DOCTYPE tv SYSTEM "https://nzxmltv.com/nzxmltv.dtd">',
 ];
 it("accepts the two known exact XMLTV DTD declarations",()=>{
  for(const declaration of accepted){
   const inner=declaration.slice("<!DOCTYPE".length,-1);
   expect(isAllowedXmltvDoctype(inner)).toBe(true);
   expect(()=>assertSafeXmltvDeclarations('<?xml version="1.0"?>'+declaration+'<tv/>')).not.toThrow();
  }
 });
 it("rejects other DTDs, modified URLs, internal subsets and all ENTITY declarations",()=>{
  const forbidden=[
   '<!DOCTYPE tv SYSTEM "http://nzxmltv.com/nzxmltv.dtd">',
   '<!DOCTYPE tv SYSTEM "https://nzxmltv.com/other.dtd">',
   '<!DOCTYPE tv SYSTEM "file:///etc/passwd">',
   '<!DOCTYPE tv SYSTEM "https://nzxmltv.com/nzxmltv.dtd" [<!ENTITY x "boom">]>',
   '<!DOCTYPE tv [<!ENTITY x SYSTEM "file:///etc/passwd">]>',
   '<!ENTITY x "boom">',
   '<!DOCTYPE tv PUBLIC "-//x//y" "xmltv.dtd">',
  ];
  for(const declaration of forbidden){
   expect(()=>assertSafeXmltvDeclarations('<?xml version="1.0"?>'+declaration+'<tv/>'),declaration)
    .toThrow("EPG_XML_SECURITY_REJECTED");
  }
 });
});
