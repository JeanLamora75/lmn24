import { isIP } from "node:net";

export const RIGHTS_FAMILIES = ["programme", "synopsis", "image", "logo"] as const;
export type RightsFamily = typeof RIGHTS_FAMILIES[number];
export type RightsStatus = "UNREVIEWED" | "APPROVED" | "REJECTED" | "EXPIRED";
export type RightsDecision = { status: RightsStatus; reference: string | null };
export type SourceRights = Record<RightsFamily, RightsDecision>;
export type EpgFormat = "XMLTV" | "XMLTV_GZIP" | "JSON";
export type SourcePriority = { sourceId: string; countryId: string; priority: number; isActive: boolean };
export type ExternalMapping = {
  sourceId: string; externalId: string; channelId: string | null;
  variantId: string | null; status: "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
};

export function canRepublish(rights: SourceRights, family: RightsFamily): boolean {
  const right = rights[family];
  return right.status === "APPROVED" && !!right.reference?.trim();
}
export function filterPublishableEpg<T>(content: Partial<Record<RightsFamily,T>>,rights:SourceRights): Partial<Record<RightsFamily,T>> {
  const published: Partial<Record<RightsFamily,T>> = {};
  for (const family of RIGHTS_FAMILIES) {
    if (content[family] !== undefined && canRepublish(rights,family)) {
      published[family]=content[family];
    }
  }
  return published;
}

/** Never approve sources based on a channel name alone. */
export function mappingIsSafe(mapping: ExternalMapping): boolean {
  return mapping.status !== "VERIFIED" || !!mapping.channelId;
}
export function assertMappingReview(mapping: ExternalMapping): void {
  if (!mapping.sourceId || !mapping.externalId.trim() || !mappingIsSafe(mapping)
    || (mapping.variantId !== null && mapping.channelId === null)) {
    throw new Error("Unverified EPG channel mapping");
  }
}
export function sourcePriorityOrder(entries: readonly SourcePriority[], countryId: string): SourcePriority[] {
  return entries.filter((entry) => entry.countryId === countryId && entry.isActive)
    .sort((a,b)=>a.priority-b.priority || a.sourceId.localeCompare(b.sourceId));
}
export function assertPriorityUniqueness(entries: readonly SourcePriority[]): void {
  const seen = new Set<string>();
  for(const e of entries){
    if(!Number.isSafeInteger(e.priority)||e.priority<1) throw new RangeError("Invalid EPG source priority");
    const key=e.countryId+":"+e.priority;
    if(seen.has(key)) throw new Error("Duplicate source priority for a country");
    seen.add(key);
  }
}

function isUnsafeIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if(parts.length!==4 || parts.some(n=>!Number.isInteger(n)||n<0||n>255)) return true;
  const [a,b,c,d]=parts as [number,number,number,number];
  return a===0 || a===10 || a===127 || a>=224 || a===169&&b===254
    || a===172&&b>=16&&b<=31 || a===192&&b===168
    || a===100&&b>=64&&b<=127 || a===198&&(b===18||b===19)
    || a===192&&b===0&&(c===0||c===2)
    || a===198&&b===51&&c===100 || a===203&&b===0&&c===113
    || a===255&&b===255&&c===255&&d===255;
}
/** Reject all literal IPv6 for now; hostname DNS resolution is checked separately. */
export function isPublicSourceAddress(ip: string): boolean {
  return isIP(ip)===4 && !isUnsafeIPv4(ip);
}

export function validateEpgSourceUrl(raw:string): URL {
  if(raw.length>2048) throw new Error("EPG source URL too long");
  let url:URL;
  try{ url=new URL(raw); }catch{ throw new Error("Invalid EPG source URL"); }
  if(!["https:","http:"].includes(url.protocol)||url.username||url.password||url.hash
     || !url.hostname || url.port && !["80","443"].includes(url.port)) throw new Error("Unsafe EPG source URL");
  const host=url.hostname.replace(/\.$/,"").toLowerCase();
  if (host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")
      ||host.endsWith(".internal")||host.endsWith(".test")
      ||host.endsWith(".invalid")||host.endsWith(".example")
      ||host.endsWith(".onion")||isIP(host)!==0
      ||!host.includes(".")||host.length>253) throw new Error("Non-public EPG source host");
  return url;
}
export const EPG_FETCH_LIMITS = {
  // Bounded headroom for global XMLTV guides (~50 MB uncompressed).
  // These caps stay enforced on both transport and decoded input to prevent
  // decompression bombs and uncontrolled memory use until streaming ingestion.
  maxCompressedBytes: 24*1024*1024,
  maxExpandedBytes: 96*1024*1024,
  maxRedirects: 0, // Disabled: no redirect bypass of DNS/SSRF checks.
  timeoutMs: 30000,
} as const;
