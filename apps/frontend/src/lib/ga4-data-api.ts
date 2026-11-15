import { createSign } from "node:crypto";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REPORT_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

type Credential = { type: string; client_email: string; private_key: string };
type GaRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type GaReport = { rows?: GaRow[]; totals?: { metricValues?: { value?: string }[] }[] };
type Rank = { name: string; value: number };
export type Ga4Audience = {
  propertyId: string;
  dateRange: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  daily: Rank[];
  countries: Rank[];
  devices: Rank[];
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function getCredentials(): Credential {
  const encoded = process.env.GA4_SERVICE_ACCOUNT_JSON_B64?.trim();
  if (!encoded) throw new Error("GA4_NOT_CONFIGURED");
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")); }
  catch { throw new Error("GA4_INVALID_CREDENTIALS"); }
  if (!parsed || typeof parsed !== "object") throw new Error("GA4_INVALID_CREDENTIALS");
  const obj = parsed as Partial<Credential>;
  if (obj.type !== "service_account" ||
    typeof obj.client_email !== "string" || !obj.client_email.endsWith(".gserviceaccount.com") ||
    typeof obj.private_key !== "string" || !obj.private_key.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GA4_INVALID_CREDENTIALS");
  }
  return obj as Credential;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.accessToken;
  const credential = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = encode({ alg: "RS256", typ: "JWT" }) + "." + encode({
    iss: credential.client_email,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const jwt = unsigned + "." + signer.sign(credential.private_key, "base64url");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("GA4_AUTH_FAILED");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || typeof (payload as {access_token?:unknown}).access_token !== "string") {
    throw new Error("GA4_AUTH_FAILED");
  }
  const data = payload as {access_token:string;expires_in?:number};
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + Math.max(60, Math.min(data.expires_in ?? 3600, 3600) - 120) * 1000 };
  return data.access_token;
}

function value(raw: string | undefined): number {
  const parsed = Number(raw ?? "0");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
function ranked(report: GaReport): Rank[] {
  return (report.rows ?? []).map(row => ({
    name: row.dimensionValues?.[0]?.value ?? "Inconnu",
    value: value(row.metricValues?.[0]?.value),
  }));
}
async function runReport(propertyId: string, accessToken: string, body: object): Promise<GaReport> {
  const response = await fetch(`${REPORT_ENDPOINT}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("GA4_REPORT_FAILED");
  return (await response.json()) as GaReport;
}

export async function getGa4Audience(days: 7 | 30): Promise<Ga4Audience> {
  const propertyId = (process.env.GA4_PROPERTY_ID ?? "391719478").trim();
  if (!/^\d{6,16}$/.test(propertyId)) throw new Error("GA4_INVALID_PROPERTY");
  const token = await getAccessToken();
  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: "today" }];
  const [totals, daily, countries, devices] = await Promise.all([
    runReport(propertyId, token, { dateRanges, metrics: [{name:"activeUsers"}, {name:"sessions"}, {name:"screenPageViews"}] }),
    runReport(propertyId, token, { dateRanges, dimensions: [{name:"date"}], metrics: [{name:"activeUsers"}], orderBys: [{dimension: {dimensionName:"date"}}], limit: days }),
    runReport(propertyId, token, { dateRanges, dimensions: [{name:"country"}], metrics: [{name:"activeUsers"}], orderBys: [{metric:{metricName:"activeUsers"},desc:true}], limit: 10 }),
    runReport(propertyId, token, { dateRanges, dimensions: [{name:"deviceCategory"}], metrics: [{name:"activeUsers"}], orderBys: [{metric:{metricName:"activeUsers"},desc:true}], limit: 10 }),
  ]);
  const metrics = totals.totals?.[0]?.metricValues ?? totals.rows?.[0]?.metricValues ?? [];
  return {
    propertyId,
    dateRange: `${days}d`,
    activeUsers: value(metrics[0]?.value),
    sessions: value(metrics[1]?.value),
    screenPageViews: value(metrics[2]?.value),
    daily: ranked(daily),
    countries: ranked(countries),
    devices: ranked(devices),
  };
}

export function isGa4Configured(): boolean {
  return Boolean(process.env.GA4_SERVICE_ACCOUNT_JSON_B64?.trim());
}
