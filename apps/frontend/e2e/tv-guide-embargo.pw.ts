import {expect,test} from "@playwright/test";

/** SCRUM-124/Murat: black-box public embargo, with no production TV data.
 * This suite runs only with TV release flags explicitly disabled.
 */
const locales=["fr","en","de","es","pt","it","ru","nl"] as const;
const widths=[320,360,390,768,1024,1440] as const;
test.describe("SCRUM-124 Guide TV public pre-GO embargo",()=>{
 test.beforeEach(()=>{
  expect(process.env.TV_PUBLIC_ENABLED).not.toBe("true");
  expect(process.env.TV_PUBLIC_RELEASE_APPROVED).not.toBe("true");
 });
 for(const locale of locales){
  test(`public TV pages reject ${locale} and remain inaccessible at all viewports`,async({page})=>{
   for(const width of widths){
    await page.setViewportSize({width,height:800});
    const response=await page.goto(`/${locale}/tv/search?q=2`);
    expect(response?.status()).toBe(404);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading",{name:/world TV search|recherche TV mondiale/i})).toHaveCount(0);
   }
   for(const path of [
    `/${locale}/tv`,`/${locale}/tv/channels/f1000000-0000-4000-8000-000000000001`,
    `/${locale}/tv/airings/f1000000-0000-4000-8000-000000000001`,
    `/${locale}/programme-tv`,
   ]){
    const response=await page.goto(path);
    expect(response?.status(),path).toBe(404);
    expect(response?.headers()["cache-control"],path).toContain("no-store");
   }
  });
 }
 test("public TV API discloses no catalogue and is never cached",async({request})=>{
  for(const path of [
   "/api/public/tv/countries", "/api/public/tv/schedule?country=FR",
   "/api/public/tv/search?q=2", "/api/public/tv/channels/f1000000-0000-4000-8000-000000000001",
   "/api/tv/public/countries",
  ]){
   const result=await request.get(path,{maxRedirects:0});
   expect(result.status(),path).toBe(404);
   expect(result.headers()["cache-control"],path).toContain("no-store");
   expect(result.headers()["x-robots-tag"],path).toContain("noindex");
   const text=await result.text();
   expect(text).not.toMatch(/"items"|"airings"|"programmeState"|"channelName"/i);
  }
 });
 for(const theme of ["light","dark"] as const){
  test(`no TV navigation or indexation in ${theme} theme`,async({page,request})=>{
   await page.emulateMedia({colorScheme:theme});
   await page.goto("/fr");
   await expect(page.locator("a[href^='/fr/tv'], a[href^='/fr/programme-tv']")).toHaveCount(0);
   const robots=await request.get("/robots.txt");
   expect(robots.status()).toBe(200);
   const staticSitemap=await request.get("/sitemaps/static.xml");
   expect(staticSitemap.status()).toBe(200);
   expect(await staticSitemap.text()).not.toMatch(/<loc>[^<]*\/(tv|programme-tv)(?:\/|<)/);
  });
 }
});
