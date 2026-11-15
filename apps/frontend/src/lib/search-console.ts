import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://www.googleapis.com/webmasters/v3";
const PROPERTY = "https://www.lmn24.com/";
const SITEMAP = "https://www.lmn24.com/sitemap.xml";

type Credentials = { type: string; client_email: string; private_key: string };
export type SearchConsoleRow = { page: string; clicks: number; impressions: number; ctr: number; position: number };
export type SitemapInfo = { path: string; lastSubmitted: string | null; lastDownloaded: string | null;
  isPending: boolean; errors: number; warnings: number; submitted: number | null; indexed: number | null };
export type SearchConsoleReport = { property: string; period: 7 | 30; rows: SearchConsoleRow[];
  totalClicks: number; totalImpressions: number; averageCtr: number; averagePosition: number | null;
  sitemap: SitemapInfo | null; sitemapStatus: "found" | "missing" | "unavailable" };

export function isSearchConsoleConfigured(): boolean {
  return Boolean((process.env.GSC_SERVICE_ACCOUNT_JSON_B64 || process.env.GA4_SERVICE_ACCOUNT_JSON_B64)?.trim());
}
export function getSearchConsoleProperty(): string {
  const property = (process.env.GSC_SITE_URL || PROPERTY).trim();
  if (!/^sc-domain:[a-z0-9.-]+$/.test(property) &&
      !/^https:\/\/[a-z0-9.-]+\/$/.test(property)) throw new Error("GSC_INVALID_PROPERTY");
  return property;
}
function credentials(): Credentials {
  const b64 = (process.env.GSC_SERVICE_ACCOUNT_JSON_B64 || process.env.GA4_SERVICE_ACCOUNT_JSON_B64)?.trim();
  if (!b64) throw new Error("GSC_NOT_CONFIGURED");
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8")); }
  catch { throw new Error("GSC_INVALID_CREDENTIALS"); }
  if (!parsed || typeof parsed !== "object") throw new Error("GSC_INVALID_CREDENTIALS");
  const data = parsed as Partial<Credentials>;
  if (data.type !== "service_account" || !data.client_email?.endsWith(".gserviceaccount.com") ||
      !data.private_key?.includes("BEGIN PRIVATE KEY")) throw new Error("GSC_INVALID_CREDENTIALS");
  return data as Credentials;
}
let cache: { token: string; expires: number } | null = null;
async function accessToken(): Promise<string> {
  if (cache && Date.now() < cache.expires) return cache.token;
  const c = credentials();
  const timestamp = Math.floor(Date.now()/1000);
  const encode = (data: object) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const header = encode({alg:"RS256",typ:"JWT"});
  const payload = encode({iss:c.client_email,scope:SCOPE,aud:TOKEN_URL,iat:timestamp,exp:timestamp+3600});
  const unsigned = header+"."+payload;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned); signer.end();
  const jwt = unsigned+"."+signer.sign(c.private_key,"base64url");
  const response = await fetch(TOKEN_URL,{method:"POST",cache:"no-store",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt}),
    signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error("GSC_AUTH_FAILED");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" ||
      typeof (data as {access_token?: unknown}).access_token !== "string") throw new Error("GSC_AUTH_FAILED");
  const token = (data as {access_token:string;expires_in?:number});
  cache = {token:token.access_token,expires:Date.now()+Math.max(60,Math.min(token.expires_in ?? 3600,3600)-120)*1000};
  return cache.token;
}
function number(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
type AnalyticsRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type AnalyticsResult = { rows?: AnalyticsRow[] };
type SitemapEntry = { path?: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean;
  errors?: string | number; warnings?: string | number;
  contents?: {type?:string;submitted?:string | number;indexed?:string | number}[] };
type SitemapsResult = { sitemap?: SitemapEntry[] };

async function api<T>(url: string, token: string, body?: object): Promise<T> {
  const response = await fetch(url,{method:body?"POST":"GET",cache:"no-store",
    headers:{authorization:"Bearer "+token,...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if (response.status === 403) throw new Error("GSC_PERMISSION_DENIED");
  if (!response.ok) throw new Error("GSC_API_UNAVAILABLE");
  return await response.json() as T;
}

export async function getSearchConsoleReport(days: 7 | 30): Promise<SearchConsoleReport> {
  const property = getSearchConsoleProperty();
  const token = await accessToken();
  const today = new Date();
  // Search Console data can be delayed: use complete days ending three days ago.
  const end = new Date(today); end.setUTCDate(end.getUTCDate()-3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-days+1);
  const day = (value: Date) => value.toISOString().slice(0,10);
  const site = encodeURIComponent(property);
  const [performance, sitemapRequest] = await Promise.all([
    api<AnalyticsResult>(API+"/sites/"+site+"/searchAnalytics/query",token,{
      startDate:day(start),endDate:day(end),dimensions:["page"],rowLimit:100,
      type:"web",dataState:"final",
    }),
    api<SitemapsResult>(API+"/sites/"+site+"/sitemaps",token).then(
      result => ({ok:true as const,result}),reason => ({ok:false as const,reason})),
  ]);
  const rows = (performance.rows ?? []).filter(row => typeof row.keys?.[0] === "string")
    .map(row=>({page:row.keys![0]!,clicks:number(row.clicks),impressions:number(row.impressions),
      ctr:number(row.ctr),position:number(row.position)}));
  // Page dimension limited to 100 rows; avoid falsely presenting their sum as site totals.
  const totals = await api<AnalyticsResult>(API+"/sites/"+site+"/searchAnalytics/query",token,{
    startDate:day(start),endDate:day(end),rowLimit:1,type:"web",dataState:"final",
  });
  const total = totals.rows?.[0];
  const entry = sitemapRequest.ok ? sitemapRequest.result.sitemap?.find(item => item.path === SITEMAP) : undefined;
  const contents = entry?.contents ?? [];
  const submitted = contents.reduce((sum,item)=>sum+number(item.submitted),0);
  const indexed = contents.reduce((sum,item)=>sum+number(item.indexed),0);
  return {property,period:days,rows,
    totalClicks:number(total?.clicks),totalImpressions:number(total?.impressions),
    averageCtr:number(total?.ctr),averagePosition:total?.position == null ? null : number(total.position),
    sitemap: entry ? {path:entry.path ?? SITEMAP,lastSubmitted:entry.lastSubmitted ?? null,
      lastDownloaded:entry.lastDownloaded ?? null,isPending:Boolean(entry.isPending),
      errors:number(entry.errors),warnings:number(entry.warnings),
      submitted:contents.length ? submitted : null,indexed:contents.length ? indexed : null} : null,
    sitemapStatus: !sitemapRequest.ok ? "unavailable" : entry ? "found" : "missing",
  };
}
