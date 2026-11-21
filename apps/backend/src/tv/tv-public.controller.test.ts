import {describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {TvPublicService} from "./tv-public.service";
import {TvPublicController} from "./tv-public.controller";
import {shouldBlockTvApi} from "./tv-public-gate";

const UUID="a2000000-0000-4000-8000-000000000001";
function setup(open=false){
 const countries=vi.fn().mockResolvedValue([{id:UUID,isoCode2:"FR",referenceTimeZone:"Europe/Paris"}]);
 const country=vi.fn().mockResolvedValue({id:UUID,isoCode2:"FR",referenceTimeZone:"Europe/Paris"});
 const schedule=vi.fn().mockResolvedValue({items:[]});
 const channelDetails=vi.fn().mockResolvedValue({channel:{id:UUID}});
 const channelAirings=vi.fn().mockResolvedValue({airings:[]});
 const airingDetails=vi.fn().mockResolvedValue({id:UUID});
 const worldSearch=vi.fn().mockResolvedValue({status:"OK",channels:{status:"OK",items:[],hasNext:false},programmes:{status:"OK",items:[],hasNext:false}});
 const service={countries,country,schedule,channelDetails,channelAirings,airingDetails,worldSearch,
  responseLanguages:()=>["fr","en"]} as unknown as TvPublicService;
 const config={get:(key:string)=>["TV_PUBLIC_ENABLED","TV_PUBLIC_RELEASE_APPROVED"].includes(key)
    ? (open?"true":"false"):undefined} as unknown as ConfigService;
 return {controller:new TvPublicController(service,config),schedule,countries,country,
   channelDetails,channelAirings,airingDetails,worldSearch};
}
describe("SCRUM-118 public TV HTTP controllers and embargo",()=>{
 it("keeps ALL routes 404 no-store before GO without touching DB",async()=>{
  const s=setup();
  await expect(s.controller.countries({})).rejects.toMatchObject({status:404});
  await expect(s.controller.schedule({country:"FR"})).rejects.toMatchObject({status:404});
  await expect(s.controller.channel(UUID,{country:"FR"})).rejects.toMatchObject({status:404});
  await expect(s.controller.channelAirings(UUID,{})).rejects.toMatchObject({status:404});
  await expect(s.controller.airing(UUID)).rejects.toMatchObject({status:404});
  await expect(s.controller.search({q:"2"})).rejects.toMatchObject({status:404});
  expect(s.worldSearch).not.toHaveBeenCalled();
  expect(s.countries).not.toHaveBeenCalled();
  expect(s.schedule).not.toHaveBeenCalled();
  expect(shouldBlockTvApi("/public/tv/schedule",{})).toBe(true);
 });
 it("accepts only allowed tabs/languages/time display and bounded pagination",async()=>{
  const s=setup(true);
  await expect(s.controller.schedule({country:"FR",tab:"UNKNOWN"}))
    .rejects.toMatchObject({status:400});
  await expect(s.controller.schedule({country:"FR",pageSize:"1000"}))
    .rejects.toMatchObject({status:400});
  await expect(s.controller.schedule({country:"FR",viewerTimeZone:"Nowhere/Bad"}))
    .rejects.toMatchObject({status:400});
  await expect(s.controller.schedule({country:"FR",tab:"NOW",page:"1",pageSize:"50"}))
    .resolves.toEqual({items:[]});
  expect(s.schedule).toHaveBeenCalledWith(expect.objectContaining({
    country:"FR",tab:"NOW",page:1,pageSize:50,
  }));
 });
 it("rejects untrusted identifiers and extra query keys",async()=>{
  const s=setup(true);
  await expect(s.controller.airing("not-uuid")).rejects.toMatchObject({status:400});
  await expect(s.controller.channel(UUID,{country:"FR",password:"bad"}))
    .rejects.toMatchObject({status:400});
  await expect(s.controller.channelAirings(UUID,{country:"FR",variantId:"bad",
    localDate:"2026-11-21"})).rejects.toMatchObject({status:400});
 });
 it("converts future NOW and out-of-range local dates to explicit 422",async()=>{
  const s=setup(true);
  s.schedule.mockRejectedValueOnce(new RangeError("TV_NOW_ONLY_TODAY"));
  await expect(s.controller.schedule({country:"FR",tab:"NOW"}))
    .rejects.toMatchObject({status:422});
  s.schedule.mockRejectedValueOnce(new RangeError("TV_DATE_OUTSIDE_J0_J6"));
  await expect(s.controller.schedule({country:"FR",localDate:"2026-01-01"}))
    .rejects.toMatchObject({status:422});
 });
 it("returns real countries without fabricating translated labels",async()=>{
  const s=setup(true);
  await expect(s.controller.countries({locale:"fr"})).resolves.toMatchObject({
    items:[{countryIso2:"FR",referenceTimeZone:"Europe/Paris"}],
    datePolicy:{daysAhead:7,reference:"COUNTRY_TIME_ZONE"},
  });
 });
 it("validates worldwide search fields and independent pagination",async()=>{
  const s=setup(true);
  await expect(s.controller.search({q:"002",channelsPage:"2",programmesPage:"3"}))
   .resolves.toMatchObject({status:"OK"});
  expect(s.worldSearch).toHaveBeenCalledWith({
   q:"002",channelsPage:2,programmesPage:3,pageSize:30,
  });
  await expect(s.controller.search({q:"   "})).rejects.toMatchObject({status:400});
  await expect(s.controller.search({q:"2",pageSize:"500"})).rejects.toMatchObject({status:400});
  await expect(s.controller.search({q:"2",country:"FR"})).rejects.toMatchObject({status:400});
 });

});