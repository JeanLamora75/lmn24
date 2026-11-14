#!/usr/bin/env node
// SCRUM-101: exhaustive, read-only production sitemap URL/status audit.
// Use only in dedicated GitHub Actions workflow; every GET is same-origin.
import { mkdir, writeFile } from "node:fs/promises";

const ORIGIN = "https://www.lmn24.com";
const ROOT = ORIGIN + "/sitemap.xml";
const MAX_SITEMAPS = 5000;
const MAX_URLS = 50000;
const CONCURRENCY = 5;
const RETRIES = 1;
const OUTPUT = process.env.SITEMAP_AUDIT_DIR || "sitemap-audit-results";
const errors = [];
const sitemapResults = [];
const pageResults = [];
const toFetch = [ROOT];
const seenSitemaps = new Set();
const seenUrls = new Set();

function decodeXml(s) {
  return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
function locs(xml) {
  // First-party sitemap format: <loc>...</loc>. Pull strictly loc elements,
  // normalize entities, and validate same-origin URLs before fetching.
  return [...xml.matchAll(/<(?:[A-Za-z0-9_-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?loc\s*>/g)]
    .map(m => decodeXml(m[1].trim()));
}
function localUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== ORIGIN || url.username || url.password || url.hash) return null;
    if (!["https:"].includes(url.protocol)) return null;
    return url;
  } catch { return null; }
}
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
async function request(raw) {
  let last;
  for (let attempt=0;attempt<=RETRIES;attempt++) {
    try {
      const response = await fetch(raw,{
        method:"GET",redirect:"manual",signal:AbortSignal.timeout(20000),
        headers:{"user-agent":"LMN24-Sitemap-Status-Audit/1.0 (read-only)",
          accept:"application/xml,text/xml,text/html,*/*"},
      });
      const status = response.status;
      const contentType=response.headers.get("content-type")||"";
      const redirect=response.headers.get("location")||null;
      const result={status,contentType,redirect};
      if ([429,502,503,504].includes(status) && attempt<RETRIES) {
        await response.body?.cancel();
        await delay(1500);continue;
      }
      // Only consume sitemap bodies, other resources are status-checked only.
      if (raw.endsWith(".xml") || raw.includes("/sitemaps/"))
        result.body=(await response.text()).slice(0,5000000);
      else await response.body?.cancel();
      return result;
    } catch(e) {
      last=e instanceof Error ? e.message : String(e);
      if (attempt<RETRIES) await delay(1500);
    }
  }
  return {status:0,contentType:"",redirect:null,error:last};
}
await mkdir(OUTPUT,{recursive:true});
while(toFetch.length) {
  if (seenSitemaps.size>=MAX_SITEMAPS){errors.push({kind:"limit",detail:"MAX_SITEMAPS exceeded"});break;}
  const url=toFetch.shift();
  if(seenSitemaps.has(url))continue;
  seenSitemaps.add(url);
  const parsed=localUrl(url);
  if(!parsed){errors.push({kind:"invalid-sitemap-url",url});continue;}
  const result=await request(url);
  const record={url,status:result.status,contentType:result.contentType,redirect:result.redirect,
    error:result.error??null};
  sitemapResults.push(record);
  if(result.status!==200){errors.push({kind:"sitemap-http",...record});continue;}
  if(!/xml/i.test(result.contentType)){errors.push({kind:"sitemap-content-type",...record});continue;}
  const xml=result.body??"";
  const urls=locs(xml);
  const index=/<(?:[\w-]+:)?sitemapindex\b/i.test(xml);
  const urlset=/<(?:[\w-]+:)?urlset\b/i.test(xml);
  if(!index&&!urlset){errors.push({kind:"invalid-sitemap-xml",url});continue;}
  if(!urls.length){errors.push({kind:"empty-sitemap",url});continue;}
  if(index){
    for(const nested of urls){
      if(!localUrl(nested)){errors.push({kind:"invalid-nested-sitemap",url:nested,parent:url});continue;}
      if(!seenSitemaps.has(nested))toFetch.push(nested);
    }
  }else{
    for(const page of urls){
      if(!localUrl(page)){errors.push({kind:"invalid-url",url:page,parent:url});continue;}
      if(seenUrls.has(page))errors.push({kind:"duplicate-url",url:page,parent:url});
      seenUrls.add(page);
    }
  }
  if(seenUrls.size>MAX_URLS){errors.push({kind:"limit",detail:"MAX_URLS exceeded"});break;}
}
const targets=[...seenUrls].sort();
let next=0;
const worker=async()=>{
  while(next<targets.length){
    const url=targets[next++];
    const result=await request(url);
    const record={url,status:result.status,redirect:result.redirect,error:result.error??null};
    pageResults.push(record);
    if(result.status!==200)errors.push({kind:"page-not-200",...record});
  }
};
await Promise.all(Array.from({length:Math.min(CONCURRENCY,targets.length)},()=>worker()));
pageResults.sort((a,b)=>a.url.localeCompare(b.url));
const statuses={};
for(const r of pageResults) statuses[String(r.status)]=(statuses[String(r.status)]||0)+1;
const report={auditedAt:new Date().toISOString(),sitemapRoot:ROOT,
  sitemapCount:seenSitemaps.size,sitemapResults,declaredUrlCount:targets.length,
  checkedUrlCount:pageResults.length,byStatus:statuses,errors,
  allUrls200:errors.length===0&&pageResults.length===targets.length, pages:pageResults};
await writeFile(OUTPUT+"/report.json",JSON.stringify(report,null,2)+"\n");
const csv=["url,status,redirect,error",...pageResults.map(r=>[r.url,r.status,r.redirect??"",r.error??""].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(","))];
await writeFile(OUTPUT+"/urls.csv",csv.join("\n")+"\n");
const summary={auditedAt:report.auditedAt,sitemapCount:report.sitemapCount,
  declaredUrlCount:report.declaredUrlCount,checkedUrlCount:report.checkedUrlCount,
  byStatus:statuses,errorCount:errors.length,allUrls200:report.allUrls200,
  exampleErrors:errors.slice(0,50)};
await writeFile(OUTPUT+"/summary.json",JSON.stringify(summary,null,2)+"\n");
console.log("SITEMAP_AUDIT_SUMMARY "+JSON.stringify(summary));
if(errors.length)process.exitCode=1;
