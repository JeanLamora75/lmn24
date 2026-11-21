import {createHash} from "node:crypto";
import type {TvWriterLease} from "./tv-import-publisher";
import {TvImportLeaseLostError} from "./tv-import-publisher";
import {downloadEpgSource} from "./tv-epg-download";
import {decodeEpgBuffer,type EpgProgramme} from "./tv-epg-decoder";
import {localDayBounds} from "./tv-import-time";
import type {ValidatedEpgLoader,EpgDayBatch,ScopeResult} from "./tv-import-worker";
import type {Coverage,AiringCandidate} from "./tv-import-policy";
import type {EpgFormat} from "./tv-epg-source-policy";

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
 options:{transport:EpgTransport;attest:AttestedCoverage;now?:Date},
):ValidatedEpgLoader{
 const db=lease.client;
 const now=options.now??new Date();
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
      s.format,s.name AS "_sourceName",sc.priority,
      s.programme_rights_status AS "programmeRightsStatus",
      s.programme_rights_reference AS "programmeRightsReference",
      s.synopsis_rights_status AS "synopsisRightsStatus",
      s.synopsis_rights_reference AS "synopsisRightsReference",
      s.image_rights_status AS "imageRightsStatus",
      s.image_rights_reference AS "imageRightsReference"
    FROM public.tv_import_scope scope
    JOIN public.tv_source s ON s.id=scope.source_id
    JOIN public.tv_source_country sc ON sc.country_id=scope.country_id
      AND sc.source_id=s.id
    WHERE scope.run_id=$1::uuid AND scope.country_id=$2::uuid
      AND scope.id::text=ANY($3::text[])
      AND scope.status='QUEUED' AND s.is_active AND sc.is_active
    ORDER BY sc.priority,s.id`,[runId,countryId,[...scopeIds]]);
  const groups=new Map<string,EpgDayBatch>();
  const results:ScopeResult[]=[];
  const matched=new Set<string>();
  for(const row of rows.rows){
    matched.add(row.scopeId);
    if(row.programmeRightsStatus!=="APPROVED"||!row.programmeRightsReference?.trim()){
      results.push({scopeId:row.scopeId,outcome:"ERROR"});continue;
    }
    try{
      if(signal.aborted)throw new TvImportLeaseLostError();
      const payload=await options.transport(row.sourceUrl,row.format);
      const decoded=await decodeEpgBuffer(payload,row.format);
      if(!decoded.programmes.length)throw new Error("No mapped EPG emissions");
      let mapped=0;
      for(const p of decoded.programmes){
        if(signal.aborted)throw new TvImportLeaseLostError();
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
        const mapping=matches.rows[0];
        if(!mapping?.variantId)continue; // never guess by similar names
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
        const start=Date.parse(p.startsAt),end=Date.parse(p.endsAt);
        const today=dateInZone(now,mapping.timezone);
        for(let n=0;n<days;n++){
          const localDate=addCalendarDays(today,n);
          const {startMs,endMs}=localDayBounds(localDate,mapping.timezone);
          if(start>=endMs||end<=startMs)continue;
          const key=mapping.variantId+":"+localDate;
          let group=groups.get(key);
          if(!group){
            const current=await db.query<{revision_id:string}>(`
              SELECT revision_id FROM public.tv_schedule_current
              WHERE variant_id=$1::uuid AND local_date=$2::date`,
              [mapping.variantId,localDate]);
            group={countryId,variantId:mapping.variantId,localDate,startMs,endMs,
              expectedRevisionId:current.rows[0]?.revision_id??null,
              candidates:[],coverage:[]};
            groups.set(key,group);
          }
          (group.candidates as AiringCandidate[]).push({
            variantId:mapping.variantId,externalId:p.externalProgrammeId,sourceId:row.sourceId,
            programmeId:id,startsAt:p.startsAt,endsAt:p.endsAt,
            fingerprint:p.fingerprint,priority:row.priority,
          });
        }
      }
      if(!mapped)throw new Error("All EPG mappings are pending review");
      results.push({scopeId:row.scopeId,outcome:"SUCCESS"});
    }catch(err){
      if(signal.aborted)throw new TvImportLeaseLostError();
      // Never propagate arbitrary source URL/content into log messages.
      results.push({scopeId:row.scopeId,outcome:"ERROR"});
    }
  }
  for(const scopeId of scopeIds){
    if(!matched.has(scopeId))results.push({scopeId,outcome:"ERROR"});
  }
  for(const group of groups.values()){
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
