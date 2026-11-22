/** SCRUM-117 — deterministic, fail-closed import selection and schedule fusion.
 * No network, DB, or publication side effects in this module.
 */
export type ImportTrigger = "AUTOMATIC" | "MANUAL";
export type CountryScope = { id: string; isActive: boolean };
export type SourceScope = {
  id: string; countryId: string; sourceActive: boolean; countrySourceActive: boolean;
  priority: number; programmesApproved: boolean; rightsEvidence?: boolean; // legacy metadata; not a publication requirement
};
export type AiringCandidate = {
  externalId: string; sourceId: string; programmeId: string; variantId: string;
  startsAt: string; endsAt: string; fingerprint: string; priority: number;
};
export type MergeResult = {
  airings: AiringCandidate[]; rejected: { fingerprint: string; reason: string }[];
  /** An empty list is NOT proof that a grid is empty. */
  canReplaceExisting: boolean;
};
export type Coverage = { startMs: number; endMs: number; sourceId: string; confirmed: boolean };

export function assertImportDays(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > 7) throw new RangeError("days must be 1..7");
  return days;
}
export function chooseImportCountries(
  countries: readonly CountryScope[], trigger: ImportTrigger, countryId?: string,
): CountryScope[] {
  if (countryId) {
    const country = countries.find(c => c.id === countryId);
    if (!country) throw new Error("Unknown TV country");
    if (trigger === "AUTOMATIC" && !country.isActive) return [];
    return [country]; // manual import permitted even for inactive countries
  }
  return countries.filter(c => c.isActive).sort((a,b)=>a.id.localeCompare(b.id));
}
export function chooseSources(
  sources: readonly SourceScope[], countryId: string,
): SourceScope[] {
  // An unlicensed source may be inspected in quarantine, but may not publish.
  return sources.filter(s=>s.countryId===countryId && s.sourceActive && s.countrySourceActive
      && s.programmesApproved && Number.isInteger(s.priority) && s.priority>0)
    .sort((a,b)=>a.priority-b.priority || a.id.localeCompare(b.id));
}
function bounds(a: AiringCandidate): {start:number;end:number} {
  const start=Date.parse(a.startsAt),end=Date.parse(a.endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error("Invalid airing interval");
  return {start,end};
}
export function mergeAirings(
  candidates: readonly AiringCandidate[], coverage: readonly Coverage[],
  dayStart: number, dayEnd: number,
): MergeResult {
  if(!Number.isFinite(dayStart)||!Number.isFinite(dayEnd)||dayEnd<=dayStart)throw new Error("Invalid day");
  const rejected:MergeResult["rejected"]=[];
  const sorted=[...candidates].sort((a,b)=>a.priority-b.priority
    || a.sourceId.localeCompare(b.sourceId)
    || a.startsAt.localeCompare(b.startsAt)
    || a.fingerprint.localeCompare(b.fingerprint));
  const seen=new Set<string>(), selected:AiringCandidate[]=[];
  for(const item of sorted){
    let b:{start:number;end:number};
    try{b=bounds(item)}catch{rejected.push({fingerprint:item.fingerprint,reason:"INVALID_INTERVAL"});continue;}
    if (b.end <= dayStart || b.start >= dayEnd) {
      rejected.push({fingerprint:item.fingerprint,reason:"OUTSIDE_SCOPE"});continue;
    }
    // Airings crossing civil midnight retain their TRUE UTC begin/end.
    // Never clip their timestamps or manufacture a second broadcast.
    const key=[item.sourceId,item.externalId,item.variantId,b.start,b.end].join("|");
    if(seen.has(key)){rejected.push({fingerprint:item.fingerprint,reason:"DUPLICATE"});continue;}
    seen.add(key);
    if(selected.some(existing=>{
      const e=bounds(existing);return b.start<e.end && e.start<b.end;
    })){
      rejected.push({fingerprint:item.fingerprint,reason:"OVERLAP"});continue;
    }
    selected.push(item);
  }
  selected.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)
    || a.fingerprint.localeCompare(b.fingerprint));
  // Completeness requires contiguous, attestable coverage; empty payload is never proof.
  const relevant=coverage.filter(c=>c.confirmed && c.startMs < dayEnd && c.endMs > dayStart
      && Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs>c.startMs)
    .map(c=>({startMs:Math.max(c.startMs,dayStart),endMs:Math.min(c.endMs,dayEnd)}))
    .sort((a,b)=>a.startMs-b.startMs);
  let covered=dayStart;
  for(const c of relevant) if(c.startMs<=covered && c.endMs>covered)covered=c.endMs;
  const canReplaceExisting=covered>=dayEnd && (selected.length>0 || relevant.length>0);
  return {airings:selected,rejected,canReplaceExisting};
}
export function deriveRunStatus(
  outcomes: readonly ("SUCCESS"|"ERROR"|"INTERRUPTED")[],
): "QUEUED"|"SUCCESS"|"PARTIAL"|"ERROR"|"INTERRUPTED" {
  if(!outcomes.length)return "QUEUED";
  if(outcomes.every(x=>x==="SUCCESS"))return "SUCCESS";
  if(outcomes.every(x=>x==="INTERRUPTED"))return "INTERRUPTED";
  if(outcomes.some(x=>x==="SUCCESS"))return "PARTIAL";
  return "ERROR";
}
export function failedScopeIds<T extends {id:string;status:string}>(scopes:readonly T[]):string[] {
  return scopes.filter(s=>s.status==="ERROR" || s.status==="INTERRUPTED").map(s=>s.id);
}
