#!/usr/bin/env node
// SCRUM-98: deterministic lab-only audit of LMN24 public pages. No account access.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = "https://www.lmn24.com";
const targets = [
  { key:"home", path:"/fr" },
  { key:"category", path:"/fr/category/international" },
  { key:"source", path:process.env.LMN24_PERF_SOURCE_PATH || "" },
  { key:"videos", path:"/fr/videos" },
  { key:"weather", path:"/fr/weather" },
  { key:"horoscope", path:"/fr/horoscope" },
];
const scenarios = ["mobile", "desktop"];
const out = process.env.LMN24_PERF_OUT || "performance-results";
await mkdir(out,{recursive:true});
const records = [];
const lighthouse = process.env.LMN24_LIGHTHOUSE_BIN || "lighthouse";

function runCli(args) {
  return new Promise(resolve => {
    const child = spawn(lighthouse,args,{stdio:["ignore","pipe","pipe"]});
    let stderr = "";
    child.stdout.on("data",()=>{});
    child.stderr.on("data",chunk=>{stderr += String(chunk).slice(-2000);});
    child.on("error",error=>resolve({code:1,error:String(error)}));
    child.on("close",code=>resolve({code:code ?? 1,error:stderr.slice(-1200)}));
  });
}

for (const target of targets) {
  if (!target.path) {
    records.push({page:target.key,status:"unmeasured",reason:"A confirmed public source URL must be provided through LMN24_PERF_SOURCE_PATH"});
    continue;
  }
  if (!/^\/[a-z]{2}(?:\/[a-z0-9-]+)*$/.test(target.path)) {
    records.push({page:target.key,status:"unmeasured",reason:"Invalid configured public URL path"});
    continue;
  }
  for (const scenario of scenarios) {
    const targetUrl = base + target.path;
    const json = join(out, `${target.key}-${scenario}.report.json`);
    const args = [targetUrl,"--quiet","--output=json","--output-path="+json,
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
      "--only-categories=performance,accessibility,best-practices,seo",
      ...(scenario==="desktop"?["--preset=desktop"]:[]),
    ];
    const result = await runCli(args);
    if (result.code !== 0) {
      records.push({page:target.key,scenario,url:targetUrl,status:"error",message:result.error});
      continue;
    }
    try {
      const report = JSON.parse(await readFile(json,"utf8"));
      const audits = report.audits || {};
      const metric = name => audits[name]?.numericValue ?? null;
      records.push({page:target.key,scenario,url:targetUrl,status:"measured",
        finalUrl:report.finalDisplayedUrl ?? report.finalUrl ?? null,
        categories:Object.fromEntries(Object.entries(report.categories||{}).map(([k,v])=>[k,v.score])),
        lcpMs:metric("largest-contentful-paint"),
        cls:metric("cumulative-layout-shift"),
        tbtMs:metric("total-blocking-time"),
        speedIndexMs:metric("speed-index"),
        ttfbMs:metric("server-response-time"),
        // INP is not derivable from a single Lighthouse navigation.
        inpMs:null, inpSource:"Requires real user interactions / CrUX field data",
        runAt:report.fetchTime ?? null,
      });
    } catch(error) {
      records.push({page:target.key,scenario,url:targetUrl,status:"error",message:String(error)});
    }
  }
}
await writeFile(join(out,"summary.json"),JSON.stringify({kind:"laboratory",method:"Lighthouse navigation: one run per URL/device",records},null,2));
for(const record of records)console.log(JSON.stringify(record));
if(records.some(x=>x.status==="error"))process.exitCode=1;
