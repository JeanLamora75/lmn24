import {createHash} from "node:crypto";
import type {TvWriterLease} from "./tv-import-publisher";
import {TvImportLeaseLostError} from "./tv-import-publisher";
import {downloadEpgSource} from "./tv-epg-download";
import {decodeEpgBuffer} from "./tv-epg-decoder";
import {localDayBounds} from "./tv-import-time";
import type {ValidatedEpgLoader,EpgDayBatch,ScopeResult} from "./tv-import-worker";
import type {Coverage,AiringCandidate} from "./tv-import-policy";
import type {EpgFormat} from "./tv-epg-source-policy";
import {classifyEpgFailure,EPG_FAILURE_CODES} from "./tv-epg-failure";

export type AttestedCoverage = (args:{
 countryId:string;sourceId:string;variantId:string;localDate:string;
 startMs:number;endMs:number;
})=>Promise<readonly Coverage[]>;

/** No source-provided claims are trusted automatically: a separate
 * provenance/quality verifier MUST explicitly attest each covered interval.
 */
export const noCoverageAttested:AttestedCoverage=async()=>[];
export type EpgTransport=(url:string,format:EpgFormat)=>Promise<Buffer>;
export const networkEpgTransport:EpgTransport=downloadEpgSource;
type Scope={scopeId:string;sourceId:string;sourceUrl:string;format:EpgFormat;priority:number;
 programmeRightsStatus:string;programmeRightsReference:string|null;
 synopsisRightsStatus:string;synopsisRightsReference:string|null;
 imageRightsStatus:string;imageRightsReference:string|null;};
type Mapping={variantId:string;timezone:string};
function deterministicUuid(scope:string,externalId:string):string{
 const hex=createHash("sha256").update(scope+"|"+externalId).digest("hex");
 return [hex.slice(0,8),hex.slice(8,12),"5"+hex.slice(13,16),
   "8"+hex.slice(17,20),hex.slice(20,32)].join("-");
}
function dateInZone(now:Date,timeZone:string):string{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"})
   .formatToParts(now);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value;
 return `${get("year")}-${get("month")}-${get("day")}`;
}
function addCalendarDays(day:string,n:number):string{
 return new Date(Date.parse(day+"T00:00:00Z")+n*86_400_000).toISOString().slice(0,10);
}
async function assertOwner(lease:TvWriterLease){
 if(lease.signal.aborted)throw new TvImportLeaseLostError();
 await lease.client.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
}
/** Adapter used ONLY within the explicit writer lease; not a public endpoint.
 * Source data and rights remain fail-closed; no certified coverage => no publish.
 */
export function createVerifiedDbEpgLoader(
 lease:TvWriterLease,runId:string,
 options:{transport:EpgTransport;attest:AttestedCoverage;now?:Date;discoveryOnly?:boolean;stagingOnly?:boolean},
):ValidatedEpgLoader{
 const db=lease.client;
 const now=options.now??new Date();
 // A global source is downloaded/decoded once per worker execution, then
 // mapped into the independently validated national publication partitions.
 // Rejected promises are shared too: a failing feed cannot be partially reused.
 const decodedSources=new Map<string,ReturnType<typeof decodeEpgBuffer>>();
 const acquire=(sourceId:string,url:string,format:EpgFormat)=>{
  const existing=decodedSources.get(sourceId);
  if(existing)return existing;
  const work=Promise.resolve().then(()=>options.transport(url,format))
   .catch(error=>{throw new Error(classifyEpgFailure(error,"DOWNLOAD"));})
   .then(payload=>decodeEpgBuffer(payload,format)
    .catch(error=>{throw new Error(classifyEpgFailure(error,"DECODE"));}));
  decodedSources.set(sourceId,work);
  return work;
 };
 return {
 async loadCountry(countryId:string,scopeIds:readonly string[],signal:AbortSignal){
  await assertOwner(lease);
  if(signal.aborted)throw new TvImportLeaseLostError();
  const requested=await db.query<{requested_days:number}>(
   "SELECT requested_days FROM public.tv_import_run WHERE id=$1::uuid",[runId]);
  const days=requested.rows[0]?.requested_days;
  if(!Number.isInteger(days)||!days||days<1||days>7)throw new Error("Invalid import duration");
  const rows=await db.query<Scope>(`
    SELECT scope.id AS "scopeId",s.id AS "sourceId",s.source_url AS "sourceUrl",
      s.format,s.name AS "_sourceName",COALESCE(sc.priority,2147483647) AS priority,
      s.programme_rights_status AS "programmeRightsStatus",
      s.programme_rights_reference AS "programmeRightsReference",
      s.synopsis_rights_status AS "synopsisRightsStatus",
      s.synopsis_rights_reference AS "synopsisRightsReference",
      s.image_rights_status AS "imageRightsStatus",
      s.image_rights_reference AS "imageRightsReference"
    FROM public.tv_import_scope scope
    JOIN public.tv_source s ON s.id=scope.source_id
    LEFT JOIN public.tv_source_country sc ON sc.country_id=scope.country_id
      AND sc.source_id=s.id
    WHERE scope.run_id=$1::uuid AND scope.country_id=$2::uuid
      AND scope.id::text=ANY($3::text[])
      AND scope.status='QUEUED' AND s.is_active
      AND (sc.source_id IS NULL OR sc.is_active)
    ORDER BY sc.priority NULLS LAST,s.id`,[runId,countryId,[...scopeIds]]);
  const groups=new Map<string,EpgDayBatch>();
  const results:ScopeResult[]=[];
  const matched=new Set<string>();
  for(const row of rows.rows){
    matched.add(row.scopeId);
    let stage:"DOWNLOAD"|"MAPPING"="DOWNLOAD";
    try{
      const staged=new Map<string,EpgDayBatch>();
      if(signal.aborted)throw new TvImportLeaseLostError();
      const decoded=await acquire(row.sourceId,row.sourceUrl,row.format);
      if(!decoded.programmes.length)throw new Error("No EPG emissions");
      // The feed is scanned as a whole, independent of any country assignment.
      // Unknown external IDs remain pending manual mapping, never guessed from names.
      const externalIds=[...new Set(decoded.programmes.map(p=>p.externalChannelId))];
      if(signal.aborted)throw new TvImportLeaseLostError();
      stage="MAPPING";
      await db.query("BEGIN");
      try{
        // Discover IDs atomically under the same fenced writer ownership.
        await db.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
        await db.query(`
          INSERT INTO public.tv_channel_external_id(source_id,external_id,mapping_status)
          SELECT $1::uuid,ids.external_id,'PENDING_REVIEW'
          FROM unnest($2::text[]) AS ids(external_id)
          ON CONFLICT(source_id,external_id) DO NOTHING`,[row.sourceId,externalIds]);
        if(signal.aborted)throw new TvImportLeaseLostError();
        await db.query("COMMIT");
      }catch(error){
        await db.query("ROLLBACK").catch(()=>undefined);
        throw error;
      }
      // Administrative discovery is restricted to external IDs. Even if a source
      // claims APPROVED rights or has verified mappings, never write programmes
      // or schedule revisions from this mode.
      if(options.discoveryOnly){
        results.push({scopeId:row.scopeId,outcome:"SUCCESS",message:"DISCOVERY_ONLY"});
        continue;
      }
      // Acquisition is allowed before republication rights approval;
      // importing to the public programme grid is NOT.
      if(row.programmeRightsStatus!=="APPROVED"||!row.programmeRightsReference?.trim()){
        results.push({scopeId:row.scopeId,outcome:"SUCCESS",
          message:options.stagingOnly?"RIGHTS_REQUIRED":"DISCOVERY_ONLY"});continue;
      }
      let mapped=0;
      const mappedChannels=new Map<string,Mapping|null>();
      for(const p of decoded.programmes){
        if(signal.aborted)throw new TvImportLeaseLostError();
        if(!mappedChannels.has(p.externalChannelId)){
          const matches=await db.query<Mapping>(`
            SELECT COALESCE(m.variant_id,cc.default_variant_id) AS "variantId",
                   v.timezone
            FROM public.tv_channel_external_id m
            JOIN public.tv_channel_country cc ON cc.channel_id=m.channel_id
              AND cc.country_id=$3::uuid
            JOIN public.tv_channel_variant v
              ON v.id=COALESCE(m.variant_id,cc.default_variant_id)
            JOIN public.tv_variant_country vc
              ON vc.variant_id=v.id AND vc.channel_country_id=cc.id
            WHERE m.source_id=$1::uuid AND m.external_id=$2
              AND m.mapping_status='VERIFIED'
            LIMIT 1`,[row.sourceId,p.externalChannelId,countryId]);
          mappedChannels.set(p.externalChannelId,matches.rows[0]??null);
        }
        const mapping=mappedChannels.get(p.externalChannelId);
        if(!mapping?.variantId)continue; // never guess by similar names
        // A feed may include past or distant future emissions. Only stage
        // programmes inside the explicitly requested calendar window.
        const start=Date.parse(p.startsAt),end=Date.parse(p.endsAt);
        const today=dateInZone(now,mapping.timezone);
        const first=localDayBounds(today,mapping.timezone).startMs;
        const last=localDayBounds(addCalendarDays(today,days-1),mapping.timezone).endMs;
        if(start>=last||end<=first)continue;
        mapped++;
        // Persist catalogue data only under current fenced lease; source rights
        // independently determine which synopsis/image fields may be reused.
        await db.query("BEGIN");
        let id:string;
        try{
          await db.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
          id=deterministicUuid(row.sourceId,p.externalProgrammeId);
          await db.query(`
            INSERT INTO public.tv_programme(id,title,synopsis,category,image_url)
            VALUES($1::uuid,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
            [id,p.originalTitle,
             row.synopsisRightsStatus==="APPROVED"&&row.synopsisRightsReference?.trim()
                ?p.originalSynopsis:null,
             p.category,
             row.imageRightsStatus==="APPROVED"&&row.imageRightsReference?.trim()
                ?p.imageUrl:null]);
          await db.query("COMMIT");
        }catch(err){await db.query("ROLLBACK").catch(()=>undefined);throw err;}
        for(let n=0;n<days;n++){
          const localDate=addCalendarDays(today,n);
          const {startMs,endMs}=localDayBounds(localDate,mapping.timezone);
          if(start>=endMs||end<=startMs)continue;
          const key=mapping.variantId+":"+localDate;
          let group=staged.get(key);
          if(!group){
            const current=await db.query<{revision_id:string}>(`
              SELECT revision_id FROM public.tv_schedule_current
              WHERE variant_id=$1::uuid AND local_date=$2::date`,
              [mapping.variantId,localDate]);
            const created:EpgDayBatch={
              countryId,variantId:mapping.variantId,localDate,
              dayStartMs:startMs,dayEndMs:endMs,
              expectedRevisionId:current.rows[0]?.revision_id??null,
              candidates:[],coverage:[],privateStaging:options.stagingOnly??false,
            };
            staged.set(key,created);
            group=created;
          }
          (group.candidates as AiringCandidate[]).push({
            variantId:mapping.variantId,externalId:p.externalProgrammeId,sourceId:row.sourceId,
            programmeId:id,startsAt:p.startsAt,endsAt:p.endsAt,
            fingerprint:p.fingerprint,priority:row.priority,
          });
        }
      }
      if(!mapped){
        // No verified mapping and licensed emission inside the requested window.
        results.push({scopeId:row.scopeId,outcome:"SUCCESS",
          message:options.stagingOnly?"MAPPINGS_REQUIRED":"DISCOVERY_ONLY"});continue;
      }
      // Only commit candidates of a completely decoded and mapped scope;
      // a partially failed source must never contaminate a published grid.
      for(const [key,entry] of staged){
        const existing=groups.get(key);
        if(existing){
          (existing.candidates as AiringCandidate[]).push(...entry.candidates);
        }else groups.set(key,entry);
      }
      results.push({scopeId:row.scopeId,outcome:"SUCCESS",
        ...(options.stagingOnly?{message:"PROGRAMMES_STAGED"}:{})});
    }catch(error){
      if(signal.aborted)throw new TvImportLeaseLostError();
      // Only a finite, reviewed diagnostic code crosses into the run history.
      const code=error instanceof Error&&EPG_FAILURE_CODES.has(error.message)
       ?error.message:classifyEpgFailure(error,stage);
      results.push({scopeId:row.scopeId,outcome:"ERROR",message:code});
    }
  }
  for(const scopeId of scopeIds){
    if(!matched.has(scopeId))results.push({scopeId,outcome:"ERROR",message:"EPG_SOURCE_UNAVAILABLE"});
  }
  for(const group of groups.values()){
    if(group.privateStaging)continue; // No unverified coverage assertions for drafts.
    const associated=[...new Set(group.candidates.map(c=>c.sourceId))];
    const verified:Coverage[]=[];
    for(const sourceId of associated){
      const spans=await options.attest({
       countryId,sourceId,variantId:group.variantId,localDate:group.localDate,
       startMs:group.dayStartMs,endMs:group.dayEndMs,
      });
      // A cover proof must be source-scoped; unverified/foreign spans ignored.
      verified.push(...spans.filter(c=>c.sourceId===sourceId && c.confirmed));
    }
    (group.coverage as Coverage[]).push(...verified);
  }
  return {days:[...groups.values()],scopeResults:results};
 },
 };
}
