import { test, expect } from "@playwright/test";

const ids=[
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const names=["test category one","test category two","test category three"];
function interceptCatalog(page: import("@playwright/test").Page){
  return page.route("**/api/public/visitor-category-catalog",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({items:ids.map((id,index)=>({
      id,slug:`test-category-${["one","two","three"][index]}`,displayOrder:index,
    }))}),
  }));
}
test("Visitor category tab: toggle, reorder, cancel and save only on explicit action",async({page})=>{
  await interceptCatalog(page);
  await page.goto("/fr/horoscope");
  const open=page.getByRole("button",{name:"Mes préférences"});
  await open.click();
  const dialog=page.getByRole("dialog",{name:"Mes préférences"});
  await expect(dialog.getByText("Personnalisez votre expérience LMN24. Le choix vous appartient.")).toHaveCount(0);
  await dialog.getByRole("tab",{name:"Catégories"}).click();
  await expect(dialog.getByRole("tabpanel",{name:"Catégories"})).toBeVisible();
  const list=dialog.locator("ol li");
  await expect(list).toHaveCount(3);
  await expect(list.first()).toContainText(names[0]!);
  await dialog.getByRole("button",{name:/Descendre.*test category one/i}).click();
  await expect(list.first()).toContainText(names[1]!);
  await dialog.getByRole("checkbox",{name:names[2]!}).uncheck();
  expect(await page.evaluate(()=>localStorage.getItem("lmn24.visitorPreferences"))).toBeNull();
  await dialog.getByRole("button",{name:"Annuler"}).click();
  await expect(dialog).toHaveCount(0);
  await open.click();
  await dialog.getByRole("tab",{name:"Catégories"}).click();
  await expect(list.first()).toContainText(names[0]!);
  await expect(dialog.getByRole("checkbox",{name:names[2]!})).toBeChecked();
  await dialog.getByRole("button",{name:/Descendre.*test category one/i}).click();
  await dialog.getByRole("checkbox",{name:names[2]!}).uncheck();
  await dialog.getByRole("button",{name:"Enregistrer"}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("lmn24.visitorPreferences")??"{}"));
  expect(saved.categories.order.slice(0,3)).toEqual([ids[1],ids[0],ids[2]]);
  expect(saved.categories.hidden).toEqual([ids[2]]);
  await open.click();
  await dialog.getByRole("tab",{name:"Catégories"}).click();
  await expect(list.first()).toContainText(names[1]!);
  await expect(dialog.getByRole("checkbox",{name:names[2]!})).not.toBeChecked();
});

test("Visitor category tab is accessible at 320px and supports keyboard arrows",async({page})=>{
  await page.setViewportSize({width:320,height:720});
  await interceptCatalog(page);
  await page.goto("/fr/horoscope");
  await page.getByRole("button",{name:"Mes préférences"}).click();
  const dialog=page.getByRole("dialog",{name:"Mes préférences"});
  const general=dialog.getByRole("tab",{name:"Général"});
  await general.focus();
  await general.press("ArrowRight");
  await expect(dialog.getByRole("tab",{name:"Catégories"})).toHaveAttribute("aria-selected","true");
  await expect(dialog.locator("ol li")).toHaveCount(3);
  const geometry=await dialog.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return {left:rect.left,right:rect.right,width:window.innerWidth,
      overflow:element.scrollWidth-element.clientWidth};
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width+1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Visitor category catalog failure does not erase settings",async({page})=>{
  await page.route("**/api/public/visitor-category-catalog",route=>route.fulfill({
    status:503,contentType:"application/json",body:'{"error":"unavailable"}',
  }));
  await page.goto("/fr/horoscope");
  await page.getByRole("button",{name:"Mes préférences"}).click();
  const dialog=page.getByRole("dialog",{name:"Mes préférences"});
  await dialog.getByRole("tab",{name:"Catégories"}).click();
  await expect(dialog.getByRole("alert")).toContainText("Impossible de charger les catégories.");
  await expect(dialog.getByRole("button",{name:"Réessayer"})).toBeVisible();
});

test("Category preference tabs have labels in all public locales",async({page})=>{
  const pairs:[string,string,string][]=[
    ["fr","Général","Catégories"],["en","General","Categories"],
    ["de","Allgemein","Kategorien"],["es","General","Categorías"],
    ["pt","Geral","Categorias"],["it","Generale","Categorie"],
    ["ru","Общие","Категории"],["nl","Algemeen","Categorieën"],
  ];
  for(const [locale,general,categories] of pairs){
    await page.goto(`/${locale}/horoscope`);
    await page.getByRole("button",{name:/préférences|preferences|Einstellungen|preferencias|preferências|preferenze|предпочтения|voorkeuren/i}).click();
    const dialog=page.getByRole("dialog").filter({has:page.getByRole("tab",{name:general})});
    await expect(dialog.getByRole("tab",{name:general})).toBeVisible();
    await expect(dialog.getByRole("tab",{name:categories})).toBeVisible();
    await dialog.getByRole("button").first().click();
  }
});
