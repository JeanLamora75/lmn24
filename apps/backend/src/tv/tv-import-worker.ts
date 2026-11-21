import { Client } from "pg";
import { acquireTvWriterLease,publishTvRevision, type ValidatedAirings } from "./tv-import-publisher";
import { deriveRunStatus,mergeAirings,type AiringCandidate,type Coverage } from "./tv-import-policy";
import { recoverAbandonedTvRuns } from "./tv-import-recovery";

/** Input comes ONLY from a vetted decoder + verified channel mapping.
 * The downloader/decoders are NOT wired to the worker until approved.
 */
export type EpgDayBatch={
  countryId:string;variantId:string;localDate:string;
  dayStartMs:number;dayEndMs:number;
  expectedRevisionId:string|null;
  candidates:readonly AiringCandidate[];
  coverage:readonly Coverage[];
};
export type ScopeResult={ scopeId:string;outcome:"SUCCESS"|"ERROR"|"INTERRUPTED";message?:string };
export interface ValidatedEpgLoader {
  loadCountry(countryId:string,scopeIds:readonly string[],signal:AbortSignal):Promise<{
    days:readonly EpgDayBatch[];
    scopeResults:readonly ScopeResult[];
  }>;
}
export class TvImportPartialError extends Error {
  constructor(message:string){super(message);this.name="TvImportPartialError";}
}
function safeMessage(e:unknown):string {
  // Never persist upstream URLs, credentials, HTTP response bodies or stack traces.
  if(e instanceof Error && /TV_EPG_COVERAGE_UNCONFIRMED|TV_CONCURRENT_EDIT|TV_SOURCE_RIGHTS_NOT_APPROVED|TV_VARIANT_NOT_IN_COUNTRY|TV_IMPORT_OWNER_LOST/.test(e.message))
    return e.message;
  return "EPG source or publication failed; previous grid preserved";
}
async function event(client:Client,runId:string,scopeId:string|null,level:"INFO"|"WARN"|"ERROR",type:string,message:string){
  await client.query(
    `INSERT INTO public.tv_import_event(run_id,scope_id,level,event_type,message)
     VALUES($1::uuid,$2::uuid,$3,$4,$5)`,[runId,scopeId,level,type,message]);
}
export async function processQueuedTvRun(
 connectionString:string,runId:string,loader:ValidatedEpgLoader,
):Promise<{runId:string;status:"QUEUED"|"SUCCESS"|"PARTIAL"|"ERROR"|"INTERRUPTED"}>{
 const lease=await acquireTvWriterLease(connectionString);
 const db=lease.client;
 try{
   // New exclusive owner first finalizes abandoned RUNNING rows.
   await recoverAbandonedTvRuns(lease);
   const started=await db.query(
     `UPDATE public.tv_import_run SET status='RUNNING',started_at=now()
      WHERE id=$1::uuid AND status='QUEUED' RETURNING id`,[runId]);
   if(started.rowCount!==1)throw new TvImportPartialError("TV run is not queued");
   const scopes=await db.query<{id:string;country_id:string}>(
     `SELECT id,country_id FROM public.tv_import_scope
      WHERE run_id=$1::uuid AND status='QUEUED' ORDER BY country_id,id`,[runId]);
   const countries=[...new Set(scopes.rows.map(s=>s.country_id))];
   const statuses=new Map<string,"SUCCESS"|"ERROR"|"INTERRUPTED">();
   for(const countryId of countries){
     const own=scopes.rows.filter(s=>s.country_id===countryId);
     if(lease.signal.aborted){
       for(const s of own)statuses.set(s.id,"INTERRUPTED");
       break;
     }
     try{
       const loaded=await loader.loadCountry(countryId,own.map(s=>s.id),lease.signal);
       const allowedScopeIds=new Set(own.map(s=>s.id));
       if(loaded.scopeResults.some(r=>!allowedScopeIds.has(r.scopeId))
          ||new Set(loaded.scopeResults.map(r=>r.scopeId)).size!==own.length)
         throw new Error("Invalid loader scope result");
       for(const day of loaded.days){
         if(day.countryId!==countryId)throw new Error("Cross-country batch rejected");
         const merge=mergeAirings(day.candidates,day.coverage,day.dayStartMs,day.dayEndMs);
         if(!merge.canReplaceExisting)throw new Error("TV_EPG_COVERAGE_UNCONFIRMED");
         const airings:ValidatedAirings[]=merge.airings.map(x=>({
            programmeId:x.programmeId,sourceId:x.sourceId,startsAt:x.startsAt,
            endsAt:x.endsAt,fingerprint:x.fingerprint,
         }));
         await publishTvRevision(lease,{
           variantId:day.variantId,countryId:day.countryId,localDate:day.localDate,
           runId,expectedRevisionId:day.expectedRevisionId,
           airings,fullCoverageConfirmed:true,
         });
         if(merge.rejected.length)await event(db,runId,null,"WARN","MERGE_CONFLICT",
           "Rejected "+merge.rejected.length+" duplicate/overlapping/invalid EPG candidates");
       }
       for(const r of loaded.scopeResults){
         const status=r.outcome;
         statuses.set(r.scopeId,status);
         await db.query(
           `UPDATE public.tv_import_scope
            SET status=$1,attempts=attempts+1,error_message=$2
            WHERE id=$3::uuid AND run_id=$4::uuid`,
           [status,status==="SUCCESS"?null:"EPG scope failed, source retained for retry",r.scopeId,runId]);
         await event(db,runId,r.scopeId,status==="SUCCESS"?"INFO":"WARN",
           status==="SUCCESS"?"SCOPE_SUCCESS":"SCOPE_FAILED",
           status==="SUCCESS"?"Imported verified scope":"Scope failed; previous data preserved");
       }
     }catch(e){
       const reason=safeMessage(e);
       // Separate transaction per publish: successful earlier country snapshots
       // survive this failure; failed country's former grid remains untouched.
       for(const scope of own){
         if(statuses.has(scope.id))continue;
         statuses.set(scope.id,lease.signal.aborted?"INTERRUPTED":"ERROR");
         if(lease.signal.aborted)break;
         await db.query(
           `UPDATE public.tv_import_scope
            SET status='ERROR',attempts=attempts+1,error_message=$1
            WHERE id=$2::uuid AND run_id=$3::uuid`,
           [reason,scope.id,runId]);
         await event(db,runId,scope.id,"ERROR","SCOPE_FAILED",reason);
       }
       if(lease.signal.aborted)break;
     }
   }
   if(lease.signal.aborted)throw new Error("TV_IMPORT_OWNER_LOST");
   const final=deriveRunStatus(scopes.rows.map(s=>statuses.get(s.id)??"INTERRUPTED"));
   await db.query(
      `UPDATE public.tv_import_run SET status=$1,finished_at=now()
       WHERE id=$2::uuid AND status='RUNNING'`,[final,runId]);
   await event(db,runId,null,final==="SUCCESS"?"INFO":"WARN","RUN_FINISHED",
     "TV import completed with status "+final);
   return {runId,status:final};
 }finally{await lease.release();}
}
