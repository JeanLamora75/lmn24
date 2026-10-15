import {describe,expect,it} from "vitest";
import {weatherCityInputSchema,weatherCityDeleteSchema,weatherCityListSchema} from "./weather-city.validation";
const valid={
 name:"Paris",slug:"paris",countryIso2:"fr",continentCode:"EU",
 latitude:48.8566,longitude:2.3522,timezone:"Europe/Paris",
 displayOrder:1,isActive:true
};
describe("SCRUM-70 — weather city input",()=>{
 it("normalizes ISO2 and allows valid decimal coordinates",()=>{
  const r=weatherCityInputSchema.parse(valid);
  expect(r.countryIso2).toBe("FR");
  expect(r.latitude).toBe(48.8566);
 });
 it("rejects invalid coordinates, IANA zones, duplicate-looking slugs and orders",()=>{
  for(const changes of [
   {latitude:91},{longitude:-181},{timezone:"Moon/Nowhere"},
   {slug:"My City"},{displayOrder:0},{isActive:"true"}
  ])expect(weatherCityInputSchema.safeParse({...valid,...changes}).success).toBe(false);
 });
 it("rejects unexpected fields and invalid continent",()=>{
  expect(weatherCityInputSchema.safeParse({...valid,id:"unexpected"}).success).toBe(false);
  expect(weatherCityInputSchema.safeParse({...valid,continentCode:"AN"}).success).toBe(false);
 });
 it("requires exact deletion confirmation and bounded query inputs",()=>{
  expect(weatherCityDeleteSchema.safeParse({confirmSlug:"paris"}).success).toBe(true);
  expect(weatherCityDeleteSchema.safeParse({}).success).toBe(false);
  expect(weatherCityListSchema.safeParse({continent:"XX"}).success).toBe(false);
  expect(weatherCityListSchema.parse({}).continent).toBe("all");
 });
});
