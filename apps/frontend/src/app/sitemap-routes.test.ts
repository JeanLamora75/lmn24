import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getIndex } from "./sitemap.xml/route";
import { GET as getStatic } from "./sitemaps/static.xml/route";
import { GET as getShard } from "./sitemaps/[kind]/[locale]/[page]/route";

afterEach(() => { vi.unstubAllGlobals(); delete process.env.BACKEND_INTERNAL_URL; });

describe("SCRUM-94 sitemap HTTP responses", () => {
  it("returns a valid HTTP XML index whose shards are bounded by public counts", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://localhost:3001";
    const stub = vi.fn(async () => new Response(JSON.stringify({
      pageSize: 1000,
      results: [
        {kind:"categories",locale:"fr",count:1},
        {kind:"sources",locale:"fr",count:0},
        {kind:"hashtags",locale:"fr",count:0},
        ...(["en","de","es","pt","it","ru","nl"] as const).flatMap(locale =>
          ["categories","sources","hashtags"].map(kind => ({kind,locale,count:0}))),
      ],
    }), {status:200,headers:{"content-type":"application/json"}}));
    vi.stubGlobal("fetch", stub);
    const response = await getIndex();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("https://www.lmn24.com/sitemaps/static.xml");
    expect(xml).toContain("https://www.lmn24.com/sitemaps/categories/fr/0");
    expect(xml).not.toContain("sitemaps/sources/fr/0");
    expect(xml).not.toContain("/admin/");
  });

  it("returns 503 rather than a misleading empty index when backend fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable",{status:503})));
    const response = await getIndex();
    expect(response.status).toBe(503);
  });

  it("serves the 8-language static routes over XML", async () => {
    const response = getStatic();
    const xml = await response.text();
    expect(response.status).toBe(200);
    expect(xml.match(/<loc>/g)?.length).toBe(136);
    expect(xml).not.toContain("/api/");
  });

  it("rejects invalid shard parameters and invalid public data", async () => {
    const invalid = await getShard(new Request("https://www.lmn24.com/"), {
      params: Promise.resolve({kind:"admin",locale:"fr",page:"0"}),
    });
    expect(invalid.status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      kind:"sources",locale:"fr",page:0,
      items:[{slug:"source-active",lastModified:"2026-11-01T00:00:00.000Z"},
        {slug:"../admin",lastModified:"2026-11-01T00:00:00.000Z"}],
    }),{status:200})));
    const response=await getShard(new Request("https://www.lmn24.com/"),{
      params:Promise.resolve({kind:"sources",locale:"fr",page:"0"}),
    });
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain("https://www.lmn24.com/fr/source/source-active");
    expect(xml).not.toContain("../admin");
  });
});
