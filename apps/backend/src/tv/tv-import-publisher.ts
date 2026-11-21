import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { ConflictException } from "@nestjs/common";

const LOCK_CLASS = 241024, LOCK_ID = 85, EPOCH_ID = 86;
export class TvImportBusyError extends Error {
  constructor() { super("TV_IMPORT_SCOPE_BUSY"); this.name="TvImportBusyError"; }
}
export class TvImportLeaseLostError extends Error {
  constructor() { super("TV_IMPORT_OWNER_LOST"); this.name="TvImportLeaseLostError"; }
}
export type TvWriterLease = {
  readonly client: Client;
  readonly ownerToken: string;
  readonly signal: AbortSignal;
  release():Promise<void>;
};

/** Reuses the exact global parser lock/epoch contract; never use a pooled
 * Prisma connection to hold session advisory locks. A lost socket aborts.
 * IMPORTANT: caller MUST stop immediately when signal aborts.
 */
export async function acquireTvWriterLease(connectionString:string):Promise<TvWriterLease> {
  if(!connectionString)throw new Error("Missing isolated database connection");
  const client=new Client({connectionString,connectionTimeoutMillis:10_000});
  const abort=new AbortController(), ownerToken=randomUUID();
  let closed=false,locked=false;
  const lost=()=>{if(!closed)abort.abort(new TvImportLeaseLostError());};
  client.on("error",lost);client.on("end",lost);
  try {
    await client.connect();
    const result=await client.query<{acquired:boolean}>(
      "SELECT pg_try_advisory_lock($1,$2) AS acquired",[LOCK_CLASS,LOCK_ID]);
    locked=result.rows[0]?.acquired===true;
    if(!locked)throw new TvImportBusyError();
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock($1,$2)",[LOCK_CLASS,EPOCH_ID]);
      await client.query(
        `INSERT INTO public.parser_write_epoch(singleton_id,owner_token,lock_backend_pid)
         VALUES(1,$1::uuid,pg_backend_pid()) ON CONFLICT(singleton_id) DO UPDATE
         SET owner_token=EXCLUDED.owner_token,lock_backend_pid=EXCLUDED.lock_backend_pid,updated_at=now()`,
        [ownerToken]);
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK").catch(()=>undefined);throw e;}
  }catch(e){
    closed=true;client.off("error",lost);client.off("end",lost);
    await client.end().catch(()=>undefined);throw e;
  }
  return {
    client,ownerToken,signal:abort.signal,
    async release(){
      if(closed)return;
      closed=true;
      try {
        if(locked && !abort.signal.aborted){
          await client.query("SELECT pg_advisory_unlock($1,$2)",[LOCK_CLASS,LOCK_ID]);
        }
      }finally{
        client.off("error",lost);client.off("end",lost);
        await client.end().catch(()=>undefined);
      }
    },
  };
}
export type ValidatedAirings = {
  programmeId:string;sourceId:string;startsAt:string;endsAt:string;fingerprint:string;
};
export type PublishInput = {
  variantId:string;countryId:string;localDate:string;runId:string;
  expectedRevisionId:string|null;airings:readonly ValidatedAirings[];
  /** Derived by separately verified coverage. Empty input alone is insufficient. */
  fullCoverageConfirmed:boolean;
};
/** Performs stage, validate and CAS switch under the SAME fenced transaction.
 * No publication is attempted for absent/unreliable EPG coverage.
 * All SQL inputs are parameters, not interpolated SQL.
 */
export async function publishTvRevision(lease:TvWriterLease,input:PublishInput):Promise<string> {
  if(lease.signal.aborted)throw new TvImportLeaseLostError();
  if(!input.fullCoverageConfirmed)throw new Error("TV_EPG_COVERAGE_UNCONFIRMED");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate))throw new Error("Invalid local date");
  for(const row of input.airings){
    if(!(Date.parse(row.startsAt)<Date.parse(row.endsAt)))throw new Error("Invalid airing span");
  }
  const client=lease.client;
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.tv_writer_owner',$1,true)",[lease.ownerToken]);
    await client.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
    // Publication is impossible with non-approved source rights or an unrelated
    // variant/country. No speculative catalogue data may become the current grid.
    const variantScope=await client.query<{found:boolean}>(
      `SELECT EXISTS (
        SELECT 1 FROM public.tv_variant_country vc
        JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
        WHERE vc.variant_id=$1::uuid AND cc.country_id=$2::uuid
      ) AS found`,[input.variantId,input.countryId]);
    if(!variantScope.rows[0]?.found)throw new Error("TV_VARIANT_NOT_IN_COUNTRY");
    for(const row of input.airings){
      const permitted=await client.query<{allowed:boolean}>(
        `SELECT EXISTS (
          SELECT 1 FROM public.tv_source s
          JOIN public.tv_source_country sc ON sc.source_id=s.id
          WHERE s.id=$1::uuid AND sc.country_id=$2::uuid
            AND s.is_active AND sc.is_active
            AND s.programme_rights_status='APPROVED'
            AND nullif(btrim(s.programme_rights_reference),'') IS NOT NULL
        ) AS allowed`,[row.sourceId,input.countryId]);
      if(!permitted.rows[0]?.allowed)throw new Error("TV_SOURCE_RIGHTS_NOT_APPROVED");
    }
    // Transaction-level scope lock; no duplicate publishes on same variant/date.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
      [input.variantId,input.localDate]);
    const previous=await client.query<{revision_id:string}>(
      `SELECT revision_id FROM public.tv_schedule_current
       WHERE variant_id=$1::uuid AND local_date=$2::date FOR UPDATE`,
      [input.variantId,input.localDate]);
    const actual=previous.rows[0]?.revision_id??null;
    if(actual!==input.expectedRevisionId)throw new ConflictException("TV_CONCURRENT_EDIT");
    const revision=await client.query<{id:string}>(
      `INSERT INTO public.tv_schedule_revision(variant_id,local_date,run_id,status)
       VALUES($1::uuid,$2::date,$3::uuid,'STAGING') RETURNING id`,
      [input.variantId,input.localDate,input.runId]);
    const revisionId=revision.rows[0]?.id;
    if(!revisionId)throw new Error("TV revision not created");
    for(const row of input.airings){
      await client.query(
        `INSERT INTO public.tv_airing(revision_id,programme_id,source_id,starts_at,ends_at,fingerprint)
         VALUES($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,$5::timestamptz,$6)`,
        [revisionId,row.programmeId,row.sourceId,row.startsAt,row.endsAt,row.fingerprint]);
    }
    await client.query(
      "UPDATE public.tv_schedule_revision SET status='VALIDATED' WHERE id=$1::uuid AND status='STAGING'",
      [revisionId]);
    if(lease.signal.aborted)throw new TvImportLeaseLostError();
    await client.query(
      `UPDATE public.tv_schedule_revision SET status='PUBLISHED',published_at=now()
       WHERE id=$1::uuid AND status='VALIDATED'`,[revisionId]);
    if(actual===null){
      await client.query(
        `INSERT INTO public.tv_schedule_current(variant_id,local_date,revision_id)
         VALUES($1::uuid,$2::date,$3::uuid)`,[input.variantId,input.localDate,revisionId]);
    }else{
      const changed=await client.query(
        `UPDATE public.tv_schedule_current SET revision_id=$1::uuid
         WHERE variant_id=$2::uuid AND local_date=$3::date AND revision_id=$4::uuid`,
        [revisionId,input.variantId,input.localDate,actual]);
      if(changed.rowCount!==1)throw new ConflictException("TV_CONCURRENT_EDIT");
    }
    if(lease.signal.aborted)throw new TvImportLeaseLostError();
    await client.query("COMMIT");
    return revisionId;
  }catch(e){
    await client.query("ROLLBACK").catch(()=>undefined);
    throw e;
  }
}
