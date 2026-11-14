import { describe, expect, it } from "vitest";
import { publicLocaleMatcher } from "./proxy-matcher";

const matches = (path: string) => new RegExp("^" + publicLocaleMatcher[0] + "$").test(path);
describe("SEO sitemap locale redirect regression",()=>{
  it("never passes sitemap shards into the next-intl locale redirect middleware",()=>{
    for(const kind of ["categories","sources","hashtags"])
      for(const locale of ["fr","en","de","es","pt","it","ru","nl"])
        expect(matches("/sitemaps/"+kind+"/"+locale+"/0")).toBe(false);
    expect(matches("/sitemaps/static.xml")).toBe(false);
    expect(matches("/sitemap.xml")).toBe(false);
    expect(matches("/robots.txt")).toBe(false);
  });
  it("keeps legitimate locale-aware pages inside the middleware",()=>{
    expect(matches("/fr")).toBe(true);
    expect(matches("/en/videos")).toBe(true);
    expect(matches("/fr/horoscope/aries")).toBe(true);
    expect(matches("/fr/category/international")).toBe(true);
  });
  it("does not intercept protected API and administration paths",()=>{
    expect(matches("/admin/login")).toBe(false);
    expect(matches("/api/admin/statistics")).toBe(false);
  });
});
