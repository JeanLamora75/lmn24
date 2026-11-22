import {describe,expect,it} from "vitest";
import {isPublicTvApiPath,shouldBlockTvApi} from "./tv-public-gate";
describe("Guide TV owner-approved public availability",()=>{
 it("allows public TV API without extra manual validation flags",()=>{
  expect(isPublicTvApiPath("/public/tv/schedule")).toBe(true);
  expect(shouldBlockTvApi("/public/tv/schedule",{})).toBe(false);
 });
 it("does not change unrelated routes",()=>{
  expect(shouldBlockTvApi("/admin/tv/channels",{})).toBe(false);
 });
});
