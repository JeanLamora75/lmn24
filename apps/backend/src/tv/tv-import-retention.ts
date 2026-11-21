import { TvWriterLease,TvImportLeaseLostError } from "./tv-import-publisher";

/** SCRUM-117: prune old TV programme snapshots under same global fencing
 * contract. Keep current pointers and catalogue; never delete current revisions.
 * A past date remains accessible for >=7 full local civil days in its variant.
 */
export async function pruneTvImportHistory(lease:TvWriterLease):Promise<{
  removedAirings:number;removedRevisions:number;removedEvents:number;removedRuns:number;removedPointers:number;
}>{
  if(lease.signal.aborted)throw new TvImportLeaseLostError();
  const client=lease.client;
  await client.query("BEGIN");
  try{
    await client.query("SELECT set_config('app.tv_writer_owner',$1,true)",[lease.ownerToken]);
    await client.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
    // On expiry, unpin only the TV date outside the seven-day archive.
    // This is fenced by the existing current-pointer owner trigger.
    await client.query("SELECT set_config('app.tv_retention','true',true)");
    const retired=await client.query(`
      DELETE FROM public.tv_schedule_current c
      USING public.tv_channel_variant v
      WHERE c.variant_id=v.id
      AND c.local_date < ((now() AT TIME ZONE v.timezone)::date - 7)
    `);
    const removedPointers=retired.rowCount??0;
    // Delete old snapshots with no active pointer. FK keeps referenced revisions.
    const deletable=await client.query<{id:string}>(
      `SELECT r.id FROM public.tv_schedule_revision r
       JOIN public.tv_channel_variant v ON v.id=r.variant_id
       LEFT JOIN public.tv_schedule_current c ON c.revision_id=r.id
       WHERE c.revision_id IS NULL
         AND r.local_date < ((now() AT TIME ZONE v.timezone)::date - 7)
       ORDER BY r.id LIMIT 500 FOR UPDATE OF r`);
    let removedAirings=0,removedRevisions=0;
    for(const row of deletable.rows){
      // SQL triggers permit DELETE of expired PUBLISHED rows only when the
      // same transaction proves exclusive lease and explicit retention mode.
      const result=await client.query(
        "DELETE FROM public.tv_airing WHERE revision_id=$1::uuid",[row.id]);
      removedAirings+=result.rowCount??0;
      const deleted=await client.query("DELETE FROM public.tv_schedule_revision WHERE id=$1::uuid",[row.id]);
      removedRevisions+=deleted.rowCount??0;
    }
    // Logs older than 30 days are removed only for completed runs.
    // Keep traces if a current revision still refers to the run.
    const events=await client.query(
      `DELETE FROM public.tv_import_event e USING public.tv_import_run r
       WHERE e.run_id=r.id AND r.status NOT IN ('QUEUED','RUNNING')
         AND e.occurred_at < now()-interval '30 days'`);
    const runs=await client.query(
      `DELETE FROM public.tv_import_run r
       WHERE r.finished_at < now()-interval '30 days'
         AND r.status NOT IN ('QUEUED','RUNNING')
         AND NOT EXISTS (SELECT 1 FROM public.tv_schedule_revision rv
           JOIN public.tv_schedule_current c ON c.revision_id=rv.id WHERE rv.run_id=r.id)`);

    if(lease.signal.aborted)throw new TvImportLeaseLostError();
    await client.query("COMMIT");
    return {removedAirings,removedRevisions,removedEvents:events.rowCount??0,removedRuns:runs.rowCount??0,removedPointers};
  }catch(err){await client.query("ROLLBACK").catch(()=>undefined);throw err;}
}
