import { describe, expect, it } from "vitest";
import {
 assertMappingReview, assertPriorityUniqueness, canRepublish, filterPublishableEpg,
 EPG_FETCH_LIMITS, isPublicSourceAddress, sourcePriorityOrder, validateEpgSourceUrl, type SourceRights,
} from "./tv-epg-source-policy";

const rights: SourceRights = {
 programme: { status:"APPROVED",reference:"https://licences.example.org/terms" },
 synopsis: { status:"UNREVIEWED",reference:null },
 image: { status:"APPROVED",reference:null },
 logo: { status:"EXPIRED",reference:"https://licences.example.org/logo" },
};
describe("SCRUM-116 EPG rights and source policy",()=>{
 it("requires explicit approval, without supplementary reference",()=>{
   expect(canRepublish(rights,"programme")).toBe(true);
   expect(canRepublish(rights,"synopsis")).toBe(false);
   expect(canRepublish(rights,"image")).toBe(true);
   expect(canRepublish(rights,"logo")).toBe(false);
   expect(filterPublishableEpg({programme:"P",synopsis:"S",image:"I",logo:"L"},rights))
     .toEqual({programme:"P",image:"I"});
 });
 it("sorts active providers by country priority then ID",()=>{
   const entries=[
    {sourceId:"b",countryId:"FR",priority:2,isActive:true},
    {sourceId:"a",countryId:"FR",priority:1,isActive:true},
    {sourceId:"x",countryId:"US",priority:1,isActive:true},
    {sourceId:"z",countryId:"FR",priority:3,isActive:false},
   ];
   expect(sourcePriorityOrder(entries,"FR").map(x=>x.sourceId)).toEqual(["a","b"]);
   expect(()=>assertPriorityUniqueness(entries)).not.toThrow();
   expect(()=>assertPriorityUniqueness([...entries,{sourceId:"c",countryId:"FR",priority:2,isActive:true}]))
      .toThrow(/Duplicate/);
 });
 it("requires exact external IDs and an explicit target for verification",()=>{
   expect(()=>assertMappingReview({sourceId:"s",externalId:"epg.2",channelId:null,variantId:null,status:"PENDING_REVIEW"}))
     .not.toThrow();
   expect(()=>assertMappingReview({sourceId:"s",externalId:"epg.2",channelId:null,variantId:null,status:"VERIFIED"}))
     .toThrow();
   expect(()=>assertMappingReview({sourceId:"s",externalId:"epg.2",channelId:"ch",variantId:"v",status:"VERIFIED"}))
     .not.toThrow();
 });
 it("keeps explicit bounded limits for large XMLTV and compressed transport",()=>{
   expect(EPG_FETCH_LIMITS.maxCompressedBytes).toBe(24*1024*1024);
   expect(EPG_FETCH_LIMITS.maxExpandedBytes).toBe(96*1024*1024);
   expect(EPG_FETCH_LIMITS.timeoutMs).toBe(30_000);
   expect(EPG_FETCH_LIMITS.maxRedirects).toBe(3);
 });
 it("refuses SSRF URL schemes, credentials, IP literals and internal DNS zones",()=>{
   expect(validateEpgSourceUrl("https://example.org/epg.xml").hostname).toBe("example.org");
   for (const u of ["file:///etc/passwd","http://localhost:8080/a","http://127.0.0.1/a",
    "http://10.0.0.1/a","http://169.254.169.254/latest","http://[::1]/a",
    "https://a.internal/api","https://u:p@example.org/feed","https://example.org:8080/feed",
    "https://example.org/#fragment","https://host.local/a"]) {
    expect(()=>validateEpgSourceUrl(u),u).toThrow();
   }
   expect(isPublicSourceAddress("1.1.1.1")).toBe(true);
   for(const ip of ["127.0.0.1","10.1.2.3","172.16.0.1","192.168.1.1",
    "169.254.169.254","100.64.0.1","198.51.100.3","::1","::ffff:127.0.0.1"])
    expect(isPublicSourceAddress(ip),ip).toBe(false);
 });
});
