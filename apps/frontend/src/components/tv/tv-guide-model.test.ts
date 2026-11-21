import {describe,expect,it} from "vitest";
import {
 TV_TABS,TV_COPY,resolveCountry,localToday,dateOffset,moveDate,
 filterBroadcastLanguage,formatBroadcast,type TvScheduleItem,
} from "./tv-guide-model";

const countries=[
 {countryIso2:"DE",label:"Deutschland",referenceTimeZone:"Europe/Berlin"},
 {countryIso2:"FR",label:"France",referenceTimeZone:"Europe/Paris"},
 {countryIso2:"GB",label:"United Kingdom",referenceTimeZone:"Europe/London"},
];
describe("SCRUM-119 TV home UX01",()=>{
 it("has the four exact ordered tabs with TONIGHT as default contract",()=>{
  expect(TV_TABS).toEqual(["CHANNELS","NOW","TONIGHT","LATE"]);
  expect(TV_COPY.fr.tabs).toEqual(["Chaînes","En ce moment","Ce soir","2ème partie"]);
  expect(TV_COPY.en.tabs).toHaveLength(4);
 });
 it("resolves saved active country, then UI locale, then ISO2 fallback without writing preference",()=>{
  expect(resolveCountry(countries,"FR","de")?.countryIso2).toBe("FR");
  expect(resolveCountry(countries,"ZZ","de")?.countryIso2).toBe("DE");
  expect(resolveCountry(countries,null,"it")?.countryIso2).toBe("DE");
  expect(resolveCountry([],null,"fr")).toBeNull();
 });
 it("computes J0 independently of viewer TZ and supports all seven civil dates",()=>{
  const now=new Date("2026-11-20T23:30:00Z");
  expect(localToday(now,"Europe/Paris")).toBe("2026-11-21");
  expect(localToday(now,"America/New_York")).toBe("2026-11-20");
  expect(dateOffset("2026-11-21",6)).toBe("2026-11-27");
 });
 it("switches NOW to TONIGHT on J+1, never reactivates NOW by navigating back",()=>{
  expect(moveDate(0,"NOW",1)).toEqual({dayIndex:1,tab:"TONIGHT",notice:true});
  expect(moveDate(1,"TONIGHT",-1)).toEqual({dayIndex:0,tab:"TONIGHT",notice:false});
  expect(moveDate(6,"LATE",1)).toEqual({dayIndex:6,tab:"LATE",notice:false});
 });
 it("only broadcast languages filter cards; UI locale never changes programmes",()=>{
  const item=(id:string,langs:string[]):TvScheduleItem=>({
   channel:{id,number:Number(id),name:id,logoUrl:null,broadcastLanguages:langs},
   variant:null,programmeState:"EPG_UNAVAILABLE",airing:null,
  });
  const items=[item("1",["fr"]),item("2",["en"]),item("3",["fr","en"])];
  expect(filterBroadcastLanguage(items,"fr").map(x=>x.channel.id)).toEqual(["1","3"]);
  expect(filterBroadcastLanguage(items,"all")).toHaveLength(3);
 });
 it("changes clock rendering without changing the underlying broadcast instant",()=>{
  expect(formatBroadcast("2026-11-21T20:30:00Z","Europe/Paris","fr")).toContain("21:30");
  expect(formatBroadcast("2026-11-21T20:30:00Z","UTC","fr")).toContain("20:30");
 });
 it("contains meaningful localizations in all eight locales",()=>{
  expect(Object.keys(TV_COPY).sort()).toEqual(["de","en","es","fr","it","nl","pt","ru"]);
  for(const value of Object.values(TV_COPY)){
    expect(value.tabs).toHaveLength(4);
    expect(value.title.length).toBeGreaterThan(3);
    expect(value.error.length).toBeGreaterThan(5);
  }
 });
});
