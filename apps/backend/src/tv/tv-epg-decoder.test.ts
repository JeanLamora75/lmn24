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
 it("reads multiple programme icons and prefers HTTPS, while retaining HTTP-only images",async()=>{
  const xml='<tv>'
   +'<programme channel="TFX.fr" start="20261122110000 +0000" stop="20261122150000 +0000">'
   +'<title>Super Nanny</title>'
   +'<icon src="http://static-cdn.tv.sfr.net/data/img/pl/9/7/1/15540179.jpg"/>'
   +'<icon src="https://example.org/super-nanny.jpg"/>'
   +'<icon src="http://static-cdn.tv.sfr.net/data/img/pl/7/7/1/15540177.jpg"/>'
   +'</programme>'
   +'<programme channel="TFX.fr" start="20261122160000 +0000" stop="20261122170000 +0000">'
   +'<title>Second show</title>'
   +'<icon src="http://static-cdn.tv.sfr.net/data/img/pl/8/8/9/16164988.jpg"/>'
   +'</programme></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.programmes.map(item=>item.imageUrl)).toEqual([
   "https://example.org/super-nanny.jpg",
   "http://static-cdn.tv.sfr.net/data/img/pl/8/8/9/16164988.jpg",
  ]);
 });
 it("reads the channel logo and country from the supplied Teleonline XMLTV sample",async()=>{
  const xml='<tv><channel id="DAZN Baloncesto 3" country="es">'
   +'<display-name>DAZN Baloncesto 3</display-name>'
   +'<display-name>DAZN Baloncesto 3 HD</display-name>'
   +'<icon src="https://raw.githubusercontent.com/davidmuma/picons_dobleM/master/icon/DAZN%20Baloncesto%203.png"/>'
   +'</channel></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels).toEqual([{
   externalId:"DAZN Baloncesto 3",name:"DAZN Baloncesto 3",
   countryIso2:"ES",
   logoUrl:"https://raw.githubusercontent.com/davidmuma/picons_dobleM/master/icon/DAZN%20Baloncesto%203.png",websiteUrl:null,
  }]);
 });
 it("extracts a single repaired icon and website from the reported country XMLTV sample",async()=>{
  const xml='<tv><channel id="TF1.Séries.Films.fr">'
   +'<icon src="https://television.telerama.frhttps://focus.telerama.fr/0000/00/01/clear-192.png"/>'
   +'<icon src="https://television.telerama.frhttps://focus.telerama.fr/0000/00/01/clear-192.png"/>'
   +'<url>http://www.telerama.fr</url>'
   +'<display-name lang="fr">TF1 Séries Films</display-name></channel></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels).toEqual([{
   externalId:"TF1.Séries.Films.fr",name:"TF1 Séries Films",countryIso2:null,
   logoUrl:"https://focus.telerama.fr/0000/00/01/clear-192.png",
   websiteUrl:"http://www.telerama.fr/",
  }]);
 });
 it("skips bad icons and invalid websites without preventing valid metadata",async()=>{
  const xml='<tv><channel id="test">'
   +'<icon src="javascript:alert(1)"/><icon src="https://example.org/logo.png"/>'
   +'<url>javascript:alert(1)</url><url>https://example.org/</url>'
   +'<display-name>Test</display-name></channel></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels?.[0]).toMatchObject({
   logoUrl:"https://example.org/logo.png",websiteUrl:"https://example.org/",
  });
 });
 it("retains distinct alternative icons without repeating identical URLs",async()=>{
  const xml='<tv><channel id="demo">'
   +'<icon src="https://example.org/clear-192.png"/>'
   +'<icon src="https://example.org/clear-192.png"/>'
   +'<icon src="https://example.org/actual.png"/>'
   +'<display-name>Demo</display-name></channel></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels?.[0]).toMatchObject({
   logoUrl:"https://example.org/clear-192.png",
   logoUrls:["https://example.org/clear-192.png","https://example.org/actual.png"],
  });
 });
 it("maps lowercase country attribute from a worldwide Teleonline channel",async()=>{
  const xml='<tv><channel id="Canal.Discovery.World.Latinoamérica.ar" country="ar">'
   +'<display-name>Canal Discovery</display-name></channel>'
   +'<channel id="No.Country"><display-name>Unknown</display-name></channel>'
   +'</tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels).toEqual([
   {externalId:"Canal.Discovery.World.Latinoamérica.ar",
    name:"Canal Discovery",countryIso2:"AR",logoUrl:null,websiteUrl:null},
   {externalId:"No.Country",name:"Unknown",countryIso2:null,logoUrl:null,websiteUrl:null},
  ]);
 });
 it("preserves explicit XMLTV channel metadata without inventing any country",async()=>{
  const xml='<tv>'
   +'<channel id="fr-one"><display-name>France 1</display-name><country>FR</country></channel>'
   +'<channel id="global"><display-name>International</display-name></channel>'
   +'<programme channel="fr-one" start="20261121190000 +0100" stop="20261121200000 +0100"><title>News</title></programme>'
   +'</tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.channels).toEqual([
   {externalId:"fr-one",name:"France 1",countryIso2:"FR",logoUrl:null,websiteUrl:null},
   {externalId:"global",name:"International",countryIso2:null,logoUrl:null,websiteUrl:null},
  ]);
  expect(decoded.programmes).toHaveLength(1);
 });
 it("decodes standard Teleonline XMLTV DOCTYPE without resolving external DTD",async()=>{
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE tv SYSTEM "xmltv.dtd">\n'
   +'<tv><programme channel="fr" start="20261121190000 +0100" stop="20261121200000 +0100">'
   +'<title>Informations</title></programme></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml,"utf8"),"XMLTV");
  expect(decoded.programmes).toHaveLength(1);
  expect(decoded.programmes[0]?.originalTitle).toBe("Informations");
 });
 it("accepts the uploaded NZXMLTV Freeview DTD as inert metadata",async()=>{
   const xml='<?xml version="1.0" encoding="utf-8"?>\n'
    +'<!DOCTYPE tv SYSTEM "https://nzxmltv.com/nzxmltv.dtd">\n'
    +'<tv generator-info-name="NZXMLTV"><channel id="tvnz1"><display-name>TVNZ 1</display-name></channel>'
    +'<programme start="20261121134000 +0000" stop="20261121143000 +0000" channel="tvnz1">'
    +'<title>TVNZ1 Quiz</title></programme></tv>';
   const decoded=await decodeEpgBuffer(Buffer.from(xml,"utf8"),"XMLTV");
   expect(decoded.programmes).toHaveLength(1);
   expect(decoded.programmes[0]?.externalChannelId).toBe("tvnz1");
 });
 it("rejects malicious ENTITY declarations even with an allowed DTD identifier",async()=>{
   const xml='<!DOCTYPE tv SYSTEM "https://nzxmltv.com/nzxmltv.dtd" [<!ENTITY xx "EXPAND">]><tv></tv>';
   await expect(decodeEpgBuffer(Buffer.from(xml),"XMLTV"))
    .rejects.toThrow("EPG_XML_SECURITY_REJECTED");
 });
 it("rejects unsupported doctypes in SAX XMLTV parsing",async()=>{
  const xml='<!DOCTYPE tv SYSTEM "malicious.dtd"><tv></tv>';
  await expect(decodeEpgBuffer(Buffer.from(xml),"XMLTV"))
   .rejects.toThrow("EPG_XML_SECURITY_REJECTED");
 });
 it("streams UTF-8 across chunk boundaries and retains escaped/CDATAs",async()=>{
  const prefix='<tv><meta>';
  const after='</meta><programme channel="fr" start="20261121190000 +0100" stop="20261121200000 +0100"><title>';
  const pad='x'.repeat(64*1024-prefix.length-after.length-1);
  const xml=prefix+pad+after+'Été &amp; cinéma</title><desc><![CDATA[Une <sélection> spéciale]]></desc></programme></tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml,"utf8"),"XMLTV");
  expect(decoded.programmes).toHaveLength(1);
  expect(decoded.programmes[0]?.originalTitle).toBe("Été & cinéma");
  expect(decoded.programmes[0]?.originalSynopsis).toBe("Une <sélection> spéciale");
 });
 it("rejects malformed trailing XML even after valid emissions",async()=>{
  const input='<tv><programme channel="fr" start="20261121190000 +0100" stop="20261121200000 +0100"><title>OK</title></programme><broken></tv>';
  await expect(decodeEpgBuffer(Buffer.from(input),"XMLTV")).rejects.toThrow();
 });
 it("requires real timezone offset and valid calendar dates",()=>{
  for(const bad of ["20261121193000","20260230000000 +0100","20261121193000 +9999"]){
   expect(()=>parseXmltvTime(bad),bad).toThrow();
  }
 });
 it("rejects XML entity expansion and external DTD",async()=>{
  const unsafe=`<?xml version="1.0"?><!DOCTYPE tv [<!ENTITY payload SYSTEM "file:///etc/passwd">]><tv><programme>&payload;</programme></tv>`;
  await expect(decodeEpgBuffer(Buffer.from(unsafe),"XMLTV")).rejects.toThrow(/EPG_XML_SECURITY_REJECTED/);
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
 it("skips real EPGSHARE01 zero-duration programmes while preserving valid ones",async()=>{
  const xml='<tv>'
   +'<programme channel="France.2..fr" start="20261123201000 +0100" stop="20261123201000 +0100"><title>Disparition inquiétante</title></programme>'
   +'<programme channel="M6.fr" start="20261121234000 +0100" stop="20261121234000 +0100"><title>NCIS : Los Angeles</title></programme>'
   +'<programme channel="France.2..fr" start="20261121190000 +0100" stop="20261121200000 +0100"><title>Journal</title></programme>'
   +'</tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.programmes).toHaveLength(1);
  expect(decoded.programmes[0]?.originalTitle).toBe("Journal");
  expect(decoded.skippedInvalidDuration).toBe(2);
 });
 it("continues to reject negative durations and invalid timezone offsets",async()=>{
  const backwards='<tv><programme channel="fr" start="20261121200000 +0100" stop="20261121190000 +0100"><title>Programme</title></programme></tv>';
  await expect(decodeEpgBuffer(Buffer.from(backwards),"XMLTV")).rejects.toThrow("Invalid EPG duration");
  const badTime='<tv><programme channel="fr" start="20261121190000" stop="20261121200000 +0100"><title>Programme</title></programme></tv>';
  await expect(decodeEpgBuffer(Buffer.from(badTime),"XMLTV")).rejects.toThrow("XMLTV timestamp must include timezone offset");
 });
 it("accepts more than the former 50,000 programme ceiling in a bounded XMLTV feed",async()=>{
  const item='<programme channel="fr" start="20261121190000 +0100" stop="20261121200000 +0100"><title>Programme</title></programme>';
  const xml='<tv>'+item.repeat(50_001)+'</tv>';
  const decoded=await decodeEpgBuffer(Buffer.from(xml),"XMLTV");
  expect(decoded.programmes).toHaveLength(50_001);
  expect(decoded.coverage).toEqual([]);
 },30_000);
 it("rejects invented durations, missing titles, excessive JSON items",async()=>{
  const src={programmes:[{id:"p",channel:"ch",start:"2026-11-21T20:30:00Z",
   end:"2026-11-21T19:30:00Z",title:"Film"}]};
  await expect(decodeEpgBuffer(Buffer.from(JSON.stringify(src)),"JSON")).rejects.toThrow();
  await expect(decodeEpgBuffer(Buffer.from('{"programmes":[{"id":"p"}]}'),"JSON")).rejects.toThrow();
 });
});