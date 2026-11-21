import { TvWriterLease,TvImportLeaseLostError } from "./tv-import-publisher";

/** SCRUM-117: prune old TV programme snapshots under same global fencing
 * contract. Keep current pointers and catalogue; never delete current revisions.
 * A past date remains accessible for >=7 full local civil days in its variant.
 */
export async function pruneTvImportHistory(lease:TvWriterLease):Promise<{
  removedAirings:number;removedRevisions:number;removedEvents:number;
}>{
  if(lease.signal.aborted)throw new TvImportLeaseLostError();
  const client=lease.client;
  await client.query("BEGIN");
  try{
    await client.query("SELECT set_config('app.tv_writer_owner',$1,true)",[lease.ownerToken]);
    await client.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
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
      // Published airings are immutable by design, even for retention.
      // Keep them unless a separately audited retention function authorizes purge.
      const meta=await client.query<{status:string}>(
        "SELECT status FROM public.tv_schedule_revision WHERE id=$1::uuid",[row.id]);
      if(meta.rows[0]?.status==="PUBLISHED")continue;
      const result=await client.query(
        "DELETE FROM public.tv_airing WHERE revision_id=$1::uuid",[row.id]);
      removedAirings+=result.rowCount??0;
      const deleted=await client.query("DELETE FROM public.tv_schedule_revision WHERE id=$1::uuid",[row.id]);
      removedRevisions+=deleted.rowCount??0;
    }
    // 30-day event retention; retain run/scope metadata for forensic traceability.
    const events=await client.query(
      "DELETE FROM public.tv_import_event WHERE occurred_at < now()-interval '30 days'");
    if(lease.signal.aborted)throw new TvImportLeaseLostError();
    await client.query("COMMIT");
    return {removedAirings,removedRevisions,removedEvents:events.rowCount??0};
  }catch(err){await client.query("ROLLBACK").catch(()=>undefined);throw err;}
}
