import { test, expect } from "@playwright/test";

const locales=["fr","en","de","es","pt","it","ru","nl"] as const;
const titles:Record<typeof locales[number],string>={
  fr:"Vos biorythmes",en:"Your biorhythms",de:"Ihre Biorhythmen",
  es:"Tus biorritmos",pt:"Os seus biorritmos",it:"I tuoi bioritmi",
  ru:"Ваши биоритмы",nl:"Jouw bioritmes",
};
const favorite="2000-02-29";
const initial = {version:1,theme:null,countryIso2:null,city:null,birthDate:favorite};

for(const locale of locales){
  test(`SCRUM-111: localized horoscope link and biorhythm page — ${locale}`,async({page})=>{
    await page.goto(`/${locale}/horoscope`);
    // The link is unique; do not depend on translations of the 12 existing signs.
    await expect(page.locator(`a[href="/${locale}/horoscope/biorythmes"]`)).toHaveCount(1);
    await expect(page.locator('a[href*="/horoscope/"]')).toHaveCount(13);
    await page.locator(`a[href="/${locale}/horoscope/biorythmes"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/horoscope/biorythmes$`));
    await expect(page.getByRole("heading",{name:titles[locale]})).toBeVisible();
    await expect(page.locator(`link[rel="canonical"][href="https://www.lmn24.com/${locale}/horoscope/biorythmes"]`)).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(8);
    await expect(page.locator(`main a[href="/${locale}/horoscope"]`)).toHaveCount(1);
    // No preference: never fabricate a personal chart.
    await expect(page.locator('svg[role="img"]')).toHaveCount(0);
    await expect(page.locator('input[type="date"]')).toHaveValue("");
  });
}

test("SCRUM-111: stored birth date drives SVG curves, but temporary change does not persist",async({page})=>{
  const leaked:string[]=[];
  await page.addInitScript((value)=>localStorage.setItem("lmn24.visitorPreferences",JSON.stringify(value)),initial);
  page.on("request",request=>{
    if(request.url().includes(favorite)||(request.postData()??"").includes(favorite))leaked.push(request.url());
  });
  await page.goto("/fr/horoscope/biorythmes");
  const date=page.getByLabel("Date de naissance");
  await expect(date).toHaveValue(favorite);
  await expect(page.locator('svg[role="img"]')).toHaveCount(1);
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  const previous=await page.evaluate(()=>localStorage.getItem("lmn24.visitorPreferences"));
  await date.fill("1990-12-31");
  await expect(page.locator('svg[role="img"]')).toHaveCount(1);
  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem("lmn24.visitorPreferences"))).toBe(previous);
  await page.getByRole("button",{name:"15 jours suivants"}).click();
  const physical = page.getByRole("checkbox",{name:/Physique/});
  await physical.focus();
  await physical.press("Space"); // keyboard accessibility, avoids sticky mobile header intercept
  await expect(physical).not.toBeChecked();
  await page.getByRole("button",{name:"Aujourd'hui"}).click();
  await page.reload();
  await expect(date).toHaveValue(favorite);
  expect(leaked).toEqual([]);
});

test("SCRUM-111: temporary birth date remains in memory only; mobile chart fits",async({page})=>{
  await page.setViewportSize({width:320,height:720});
  await page.goto("/fr/horoscope/biorythmes");
  const date=page.getByLabel("Date de naissance");
  await date.fill("2000-02-29");
  await expect(page.locator('svg[role="img"]')).toHaveCount(1);
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  const geometry=await page.locator("section[aria-label='Vos biorythmes']").evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return {left:rect.left,right:rect.right,viewport:window.innerWidth,
      overflow:element.scrollWidth-element.clientWidth};
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport+1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
  await page.reload();
  await expect(date).toHaveValue("");
});
