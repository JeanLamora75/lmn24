#!/usr/bin/env node
// SCRUM-100: read-only production HTML acceptance. Run after deployment; not a CI build gate.
const SITE = "https://www.lmn24.com";
const locales = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"];
const sections = ["", "/videos", "/hashtags", "/weather", "/horoscope"];
const paths = locales.flatMap(lang => sections.map(section => "/" + lang + section));
paths.push("/fr/category/international", "/admin/login", "/robots.txt", "/sitemap.xml");
const errors = [];
const observations = [];
const attr = (tag, name) => tag.match(new RegExp("(?:^|\\s)" + name + "=[\"']([^\"']*)[\"']", "i"))?.[1] ?? null;
function inspectHtml(html, path) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(x => x[0]);
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map(x => x[0]);
  const canonical = links.filter(link => attr(link, "rel") === "canonical").map(link => attr(link, "href"));
  const hreflang = links.filter(link => attr(link, "rel") === "alternate" && attr(link, "hreflang"))
    .map(link => ({lang: attr(link, "hreflang"), href: attr(link, "href")}));
  const robots = meta.filter(m => attr(m, "name") === "robots").map(m => attr(m, "content") ?? "");
  const description = meta.filter(m => attr(m, "name") === "description").map(m => attr(m, "content") ?? "");
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1]?.trim());
  const h1 = [...html.matchAll(/<h1(?:\s|>)/gi)].length;
  const jsonld = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1] ?? "");
  const mistakes = [];
  if (path.startsWith("/admin")) {
    if (!robots.some(value => /(?:^|,)\s*noindex\b/i.test(value)))
      mistakes.push("admin login missing noindex");
    return {h1, canonical, hreflangCount: hreflang.length, errors: mistakes};
  }
  const language = path.split("/")[1];
  if (!titles.length || !titles[0]) mistakes.push("missing title");
  if (!description.length || !description[0]) mistakes.push("missing description");
  if (canonical.length !== 1 || canonical[0] !== SITE + path)
    mistakes.push("expected one canonical " + SITE + path + ", got " + JSON.stringify(canonical));
  if (sections.some(section => path === "/" + language + section)) {
    if (hreflang.length !== 8 || new Set(hreflang.map(x => x.lang)).size !== 8)
      mistakes.push("expected eight distinct hreflang alternates");
    for (const target of locales) {
      const alternate = hreflang.find(x => x.lang === target);
      const expected = SITE + "/" + target + path.slice(language.length + 1);
      if (alternate?.href !== expected)
        mistakes.push("hreflang " + target + " expected " + expected + ", got " + alternate?.href);
    }
  }
  if (!h1) mistakes.push("missing H1");
  if (!jsonld.length) mistakes.push("missing JSON-LD");
  for (const [idx, json] of jsonld.entries()) {
    try {
      const data = JSON.parse(json);
      if (data["@context"] !== "https://schema.org") mistakes.push("JSON-LD " + idx + " invalid context");
    } catch {mistakes.push("JSON-LD " + idx + " invalid JSON");}
  }
  return {h1, title:titles[0], canonical, hreflangCount:hreflang.length,
    description:description[0], jsonldCount:jsonld.length, errors:mistakes};
}
for (const path of paths) {
  const url = SITE + path;
  try {
    const response = await fetch(url, {redirect:"follow",signal:AbortSignal.timeout(15000),
      headers:{"user-agent":"LMN24-SEO-Acceptance/1.0","accept":"text/html,application/xml,text/plain"}});
    const type = response.headers.get("content-type") ?? "";
    const body = (await response.text()).slice(0,1000000);
    const failures = [];
    if (response.status !== 200) failures.push("HTTP "+response.status);
    if (path === "/robots.txt") {
      if (!body.includes("Sitemap: "+SITE+"/sitemap.xml")) failures.push("missing sitemap declaration");
      if (!/Disallow:\s*\/admin/i.test(body)) failures.push("admin crawl exclusion missing");
    } else if (path === "/sitemap.xml") {
      if (!type.includes("xml")) failures.push("non-XML content type");
      if (!body.includes("<sitemapindex")) failures.push("missing sitemap index");
      if (/\/(?:admin|api)\//.test(body)) failures.push("private routes in sitemap");
    } else if (type.includes("html")) {
      const details = inspectHtml(body,path);
      failures.push(...details.errors);
      observations.push({path,url,status:response.status,...details,errors:failures});
    } else failures.push("non-HTML response");
    if (failures.length && (path === "/robots.txt" || path === "/sitemap.xml"))
      observations.push({path,url,status:response.status,errors:failures});
    errors.push(...failures.map(error => ({url,error})));
  } catch(err) {
    errors.push({url,error:err instanceof Error ? err.message : String(err)});
  }
}
console.log(JSON.stringify({tested:paths.length,failures:errors.length,errors,observations},null,2));
if (errors.length) process.exitCode = 1;
