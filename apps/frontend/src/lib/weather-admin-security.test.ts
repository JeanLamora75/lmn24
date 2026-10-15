import {describe,expect,it} from "vitest";
import {weatherMutationAllowed} from "./weather-admin-security";
function req(origin?:string,site?:string) {
 const headers:Record<string,string>={};
 if(origin)headers.origin=origin;
 if(site)headers["sec-fetch-site"]=site;
 return new Request("https://lmn24.example/api/admin/weather-cities",{headers});
}
describe("SCRUM-70 — weather mutation origin",()=>{
 it("accepts same-origin browser writes",()=>{
  expect(weatherMutationAllowed(req("https://lmn24.example","same-origin"))).toBe(true);
  expect(weatherMutationAllowed(req(undefined,"same-origin"))).toBe(true);
 });
 it("rejects malicious origins and cross-site requests",()=>{
  expect(weatherMutationAllowed(req("https://other.example","cross-site"))).toBe(false);
  expect(weatherMutationAllowed(req("https://other.example"))).toBe(false);
  expect(weatherMutationAllowed(req())).toBe(false);
  expect(weatherMutationAllowed(req("not a url"))).toBe(false);
 });
});
