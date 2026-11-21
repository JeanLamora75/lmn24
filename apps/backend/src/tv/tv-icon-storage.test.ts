import {describe,expect,it} from "vitest";
import {isLocalTvIcon,validateUploadedIcon,MAX_TV_ICON_BYTES} from "./tv-icon-storage";
import {assertTvLogoUrl} from "./tv-catalog-policy";

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const jpg=Buffer.from([255,216,255,224,0,0,0,0]);
const webp=Buffer.from("RIFFxxxxWEBP1234","ascii");
const path="/tv-icons/"+"a".repeat(64)+".png";
describe("TV channel icon safety",()=>{
 it("accepts PNG, JPG and WebP signatures for local uploads",()=>{
  for(const bytes of [png,jpg,webp])
   expect(validateUploadedIcon(bytes.toString("base64"))).toEqual(bytes);
 });
 it("refuses SVG, arbitrary text, invalid encoding and oversized images",()=>{
  for(const payload of [
   Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString("base64"),
   Buffer.from("not an image").toString("base64"),
   "!!!",Buffer.concat([png,Buffer.alloc(MAX_TV_ICON_BYTES)]).toString("base64"),
  ])expect(()=>validateUploadedIcon(payload)).toThrow();
 });
 it("allows only hashed local TV icon paths as database logo URLs",()=>{
  expect(isLocalTvIcon(path)).toBe(true);
  expect(assertTvLogoUrl(path)).toBe(path);
  for(const candidate of [
   "/tv-icons/../secret.png","/tv-icons/script.svg",
   "/tv-icons/"+ "x".repeat(64)+".png", "/private/image.png",
  ]){
   expect(isLocalTvIcon(candidate)).toBe(false);
   expect(()=>assertTvLogoUrl(candidate)).toThrow();
  }
 });
});
