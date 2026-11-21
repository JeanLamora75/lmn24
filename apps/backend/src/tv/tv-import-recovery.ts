import type {TvWriterLease} from "./tv-import-publisher";
import {TvImportLeaseLostError} from "./tv-import-publisher";

/** Recovery must hold the exclusive global parser/TV lock. This guarantees
 * no living importer can still publish when its RUNNING scopes are interrupted.
 */
export async function recoverAbandonedTvRuns(lease:TvWriterLease):Promise<number>{
  if(lease.signal.aborted)throw new TvImportLeaseLostError();
  const db=lease.client;
  await db.query("BEGIN");
  try {
    await db.query("SELECT public.assert_parser_write_epoch($1::uuid)",[lease.ownerToken]);
    const stale=await db.query<{id:string}>(`
      SELECT id FROM public.tv_import_run WHERE status='RUNNING'
      ORDER BY id FOR UPDATE`);
    for(const {id} of stale.rows){
      await db.query(`
        UPDATE public.tv_import_scope
        SET status='INTERRUPTED',error_message='Interrupted by process exit; retry is available'
        WHERE run_id=$1::uuid AND status IN ('RUNNING','QUEUED')`,[id]);
      await db.query(`
        UPDATE public.tv_import_run
        SET status=CASE
          WHEN EXISTS(SELECT 1 FROM public.tv_import_scope
            WHERE run_id=$1::uuid AND status='SUCCESS')
          THEN 'PARTIAL' ELSE 'INTERRUPTED' END,
          finished_at=now()
        WHERE id=$1::uuid AND status='RUNNING'`,[id]);
      await db.query(`
        INSERT INTO public.tv_import_event(run_id,level,event_type,message)
        VALUES($1::uuid,'WARN','RECOVERED','Prior writer crashed; successful scopes retained')
      `,[id]);
    }
    if(lease.signal.aborted)throw new TvImportLeaseLostError();
    await db.query("COMMIT");
    return stale.rows.length;
  }catch(error){await db.query("ROLLBACK").catch(()=>undefined);throw error;}
}
