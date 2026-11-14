#!/usr/bin/env node
// Passive, read-only, reproducible production SEO audit. No credentials or writes.
const origin = "https://www.lmn24.com";
const locales = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"];
const urls = [
  origin, "http://lmn24.com/", "https://lmn24.com/", "http://www.lmn24.com/",
  origin + "/robots.txt", origin + "/sitemap.xml",
  ...locales.map(l => origin + "/" + l),
  ...["/fr/weather","/fr/videos","/fr/horoscope","/fr/horoscope/aries",
    "/fr/hashtags","/fr/category/international","/fr/source/does-not-exist-seo-audit-99999",
    "/fr/hashtags/does-not-exist-seo-audit-99999",
    "/fr/category/does-not-exist-seo-audit-99999",
    "/fr/horoscope/does-not-exist-seo-audit-99999",
    "/admin","/admin/login","/api/admin/statistics","/fr/does-not-exist-seo-audit-99999"]
    .map(path => origin + path),
];
function tags(html) {
 const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
 const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
 const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);
 const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
 const attr=(tag,name)=> tag.match(new RegExp('(?:^|\\s)'+name+'=["\\x27]([^"\\x27]*)["\\x27]','i'))?.[1] ?? null;
 const canonical=links.filter(x=>attr(x,"rel")==="canonical").map(x=>attr(x,"href"));
 const hreflang=links.filter(x=>attr(x,"rel")==="alternate"&&attr(x,"hreflang")).map(x=>[attr(x,"hreflang"),attr(x,"href")]);
 const robots=metas.filter(x=>attr(x,"name")?.toLowerCase()==="robots").map(x=>attr(x,"content"));
 const description=metas.filter(x=>attr(x,"name")?.toLowerCase()==="description").map(x=>attr(x,"content"));
 return { title, description, canonical, hreflang, robots,
   htmlLang: html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]??null,
   h1: [...html.matchAll(/<h1(?:\s|>)/gi)].length,
   jsonld: [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["']/gi)].length
 };
}
for (const url of urls) {
 try {
  const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(12000),headers:{"user-agent":"LMN24-SEO-Audit/1.0 (+https://github.com/JeanLamora75/lmn24)","accept":"text/html,application/xml,text/plain"}});
  const type=r.headers.get("content-type")??"";
  const body=(await r.text()).slice(0,350000);
  const data={requested:url,status:r.status,finalUrl:r.url,contentType:type,bytes:body.length,
     ...(type.includes("html")?tags(body):{start:body.slice(0,220).replace(/\s+/g," ")})};
  console.log(JSON.stringify(data));
 } catch(e) {
  console.log(JSON.stringify({requested:url,error:e instanceof Error?e.name+":"+e.message:String(e)}));
 }
}
