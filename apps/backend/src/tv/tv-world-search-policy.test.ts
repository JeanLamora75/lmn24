import {describe,expect,it} from "vitest";
import {classifyTvWorldQuery} from "./tv-world-search-policy";
describe("SCRUM-121 world TV query classification",()=>{
 it("normalizes ASCII numbers with leading zeros, never substrings",()=>{
  expect(classifyTvWorldQuery(" 002 ")).toEqual({query:"002",numeric:true,number:2});
  expect(classifyTvWorldQuery("0")).toEqual({query:"0",numeric:true,number:0});
  expect(classifyTvWorldQuery("12")).toEqual({query:"12",numeric:true,number:12});
 });
 it("treats mixed numbers, Unicode digits and letters as text",()=>{
  for(const value of ["France 2","2A","٢","2 3","été"]){
   expect(classifyTvWorldQuery(value).numeric).toBe(false);
  }
 });
 it("does not overflow SQL integer range",()=>{
  expect(classifyTvWorldQuery("999999999999999999999999").number).toBe(null);
  expect(classifyTvWorldQuery("2147483647").number).toBe(2147483647);
 });
});
