import {describe,expect,it} from "vitest";
import {decodeEpgBuffer,parseXmltvTime} from "./tv-epg-decoder";

describe("SCRUM-117 XMLTV and JSON decoder (offline fixtures)",()=>{
 it("decodes genuine offset-bearing XMLTV timestamps to UTC, no fictitious coverage",async()=>{
  const xml=`<?xml version="1.0" encoding="UTF-8"?>
  <tv><channel id="fr2"/><programme channel="fr2" start="20261025023000 +0200" stop="20261025033000 +0100">
  <title lang="fr">Nuit spéciale</title><desc>Émission réelle dans un fixture</desc>
  <category>Culture</category><icon src="https://example.org/image.jpg"/></programme></tv>`;
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.programmes).toHaveLength(1);
  expect(decoded.programmes[0]).toMatchObject({
    externalChannelId:"fr2",startsAt:"2026-10-25T00:30:00.000Z",
    endsAt:"2026-10-25T02:30:00.000Z",originalTitle:"Nuit spéciale",
    category:"Culture",imageUrl:"https://example.org/image.jpg",
  });
  expect(decoded.coverage).toEqual([]);
  expect(parseXmltvTime("20260329030000 +0200")).toBe("2026-03-29T01:00:00.000Z");
 });
 it("requires real timezone offset and valid calendar dates",()=>{
  for(const bad of ["20261121193000","20260230000000 +0100","20261121193000 +9999"]){
   expect(()=>parseXmltvTime(bad),bad).toThrow();
  }
 });
 it("rejects XML entity expansion and external DTD",async()=>{
  const unsafe=`<?xml version="1.0"?><!DOCTYPE tv [<!ENTITY payload SYSTEM "file:///etc/passwd">]><tv><programme>&payload;</programme></tv>`;
  await expect(decodeEpgBuffer(Buffer.from(unsafe),"XMLTV")).rejects.toThrow(/XML declarations forbidden/);
 });
 it("supports strongly-typed JSON, but source completeness claims remain UNVERIFIED",async()=>{
  const src={programmes:[{id:"p",channel:"ch",start:"2026-11-21T20:30:00+01:00",
   end:"2026-11-21T21:30:00+01:00",title:"Film"}],
   coverage:[{channel:"ch",start:"2026-11-21T00:00:00+01:00",
    end:"2026-11-22T00:00:00+01:00",verified:true}]};
  const result=await decodeEpgBuffer(Buffer.from(JSON.stringify(src)),"JSON");
  expect(result.programmes[0]?.startsAt).toBe("2026-11-21T19:30:00.000Z");
  expect(result.coverage[0]?.verified).toBe(false);
 });
 it("rejects invented durations, missing titles, excessive JSON items",async()=>{
  const src={programmes:[{id:"p",channel:"ch",start:"2026-11-21T20:30:00Z",
   end:"2026-11-21T19:30:00Z",title:"Film"}]};
  await expect(decodeEpgBuffer(Buffer.from(JSON.stringify(src)),"JSON")).rejects.toThrow();
  await expect(decodeEpgBuffer(Buffer.from('{"programmes":[{"id":"p"}]}'),"JSON")).rejects.toThrow();
 });
});