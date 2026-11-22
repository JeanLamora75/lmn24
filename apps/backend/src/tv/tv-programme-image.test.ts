import {describe,expect,it,vi} from "vitest";
import {makeProgrammeImageResolver} from "./tv-programme-image";

describe("Programme artwork URL selection",()=>{
 it("prefers a working secure endpoint for an HTTP URL",async()=>{
  const probe=vi.fn(async()=>true);
  const resolve=makeProgrammeImageResolver(probe);
  await expect(resolve("http://static-cdn.tv.sfr.net/data/img/a.jpg"))
    .resolves.toBe("https://static-cdn.tv.sfr.net/data/img/a.jpg");
  expect(probe).toHaveBeenCalledWith("https://static-cdn.tv.sfr.net/data/img/a.jpg");
 });
 it("keeps original HTTP when HTTPS does not serve an image",async()=>{
  const probe=vi.fn(async()=>false);
  const resolve=makeProgrammeImageResolver(probe);
  await expect(resolve("http://static-cdn.tv.sfr.net/data/img/a.jpg"))
    .resolves.toBe("http://static-cdn.tv.sfr.net/data/img/a.jpg");
 });
 it("does not probe existing HTTPS URLs, invalid or unsafe schemes",async()=>{
  const probe=vi.fn(async()=>true);
  const resolve=makeProgrammeImageResolver(probe);
  await expect(resolve("https://example.org/image.jpg")).resolves.toBe("https://example.org/image.jpg");
  await expect(resolve("javascript:alert(1)")).resolves.toBeNull();
  await expect(resolve(null)).resolves.toBeNull();
  expect(probe).not.toHaveBeenCalled();
 });
 it("deduplicates HTTPS probes for identical programme image URLs",async()=>{
  const probe=vi.fn(async()=>true);
  const resolve=makeProgrammeImageResolver(probe);
  const [first,second]=await Promise.all([
   resolve("http://example.org/image.jpg"),resolve("http://example.org/image.jpg"),
  ]);
  expect(first).toBe("https://example.org/image.jpg");
  expect(second).toBe(first);
  expect(probe).toHaveBeenCalledTimes(1);
 });
});
