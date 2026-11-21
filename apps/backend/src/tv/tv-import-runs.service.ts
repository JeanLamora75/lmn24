import {
  ConflictException, Injectable, NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { assertImportDays,deriveRunStatus,failedScopeIds } from "./tv-import-policy";

export type ImportRequest = {
  trigger:"MANUAL"|"AUTOMATIC";days:number;countryId?:string|undefined;
  mode?:"DISCOVERY"|"STAGING"|undefined;
};
/** Admin orchestration only: no automatic external EPG download, or publishing,
 * until SCRUM-114 schema and SCRUM-117 ingestion integration are approved.
 */
@Injectable()
export class TvImportRunsService {
  constructor(private readonly database:DatabaseService){}
  private async requireSchema():Promise<void>{
    const rows=await this.database.prisma.$queryRaw<Array<{ok:boolean}>>`
      SELECT to_regclass('public.tv_import_run') IS NOT NULL
        AND to_regclass('public.tv_import_scope') IS NOT NULL
        AND to_regclass('public.tv_import_event') IS NOT NULL AS ok
    `;
    if(!rows[0]?.ok)throw new ServiceUnavailableException("TV import tables are not installed");
  }
  async create(input:ImportRequest){
    await this.requireSchema();
    assertImportDays(input.days);
    return this.database.prisma.$transaction(async tx=>{
      // Serialize queue creation across processes (distinct from parser lease).
      // PostgreSQL returns a `void` value for pg_advisory_xact_lock.
      // Prisma cannot deserialize that result type, so project a supported integer
      // while keeping the lock held for the full transaction.
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(241024,87)`;
      // One automatic run per UTC calendar day, even if it has completed.
      // Checked under the same PostgreSQL queue-advisory lock as enqueue.
      if(input.trigger==="AUTOMATIC"){
        const existing=await tx.$queryRaw<Array<{id:string;status:string}>>`
          SELECT id,status FROM public.tv_import_run
          WHERE trigger='AUTOMATIC'
            AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
            AND created_at < (date_trunc('day',now() AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'
          ORDER BY created_at DESC LIMIT 1
        `;
        if(existing[0])return {id:existing[0].id,status:existing[0].status,scopeCount:0,alreadyScheduled:true};
      }
      const countries=await tx.$queryRaw<Array<{countryId:string}>>`
        SELECT country_id AS "countryId" FROM public.tv_country
        WHERE (${input.countryId??null}::uuid IS NULL AND is_active=TRUE)
          OR (${input.countryId??null}::uuid IS NOT NULL
            AND country_id=${input.countryId??null}::uuid
            AND (${input.trigger}='MANUAL' OR is_active=TRUE))
        ORDER BY country_id
      `;
      if(countries.length===0)throw new NotFoundException("No eligible TV countries");
      const wanted=countries.map(c=>c.countryId);
      const busy=await tx.$queryRaw<Array<{id:string}>>`
        SELECT scope.id FROM public.tv_import_scope scope
        JOIN public.tv_import_run r ON r.id=scope.run_id
        WHERE scope.country_id::text=ANY(${wanted}::text[])
          AND r.status IN ('QUEUED','RUNNING')
        LIMIT 1
      `;
      if(busy.length)throw new ConflictException("TV_IMPORT_SCOPE_BUSY");
      const run=await tx.$queryRaw<Array<{id:string}>>`
        INSERT INTO public.tv_import_run(trigger,requested_days,status)
        VALUES(${input.trigger},${input.days},'QUEUED') RETURNING id
      `;
      const id=run[0]?.id;
      if(!id)throw new Error("TV import run creation failed");
      for(const c of countries) {
        // Active EPG sources are global by default. A legacy country row is only
        // an optional explicit override (disable/priority), never required.
        // Per-country scopes are downstream publication partitions, not collection filters.
        const sources=await tx.$queryRaw<Array<{sourceId:string}>>`
          SELECT s.id AS "sourceId" FROM public.tv_source s
          LEFT JOIN public.tv_source_country sc ON sc.source_id=s.id
            AND sc.country_id=${c.countryId}::uuid
          WHERE s.is_active
            AND (sc.source_id IS NULL OR sc.is_active)
          ORDER BY sc.priority NULLS LAST,s.id
        `;
        for(const s of sources){
          await tx.$executeRaw`
            INSERT INTO public.tv_import_scope(run_id,country_id,source_id,status)
            VALUES(${id}::uuid,${c.countryId}::uuid,${s.sourceId}::uuid,'QUEUED')
          `;
        }
      }
      const counts=await tx.$queryRaw<Array<{n:number}>>`
        SELECT count(*)::int AS n FROM public.tv_import_scope WHERE run_id=${id}::uuid
      `;
      if(!counts[0]?.n)throw new ConflictException("No enabled global EPG sources for requested countries");
      await tx.$executeRaw`
        INSERT INTO public.tv_import_event(run_id,level,event_type,message)
        VALUES(${id}::uuid,'INFO','QUEUED','EPG import queued for isolated processing')
      `;
      if(input.mode==="STAGING"){
        await tx.$executeRaw`
          INSERT INTO public.tv_import_event(run_id,level,event_type,message)
          VALUES(${id}::uuid,'INFO','RUN_MODE_STAGING','Private programme staging; no public schedule')
        `;
      }
      return {id,status:"QUEUED" as const,scopeCount:counts[0].n};
    });
  }

  /** Reuse an exact pending manual single-country request when the user
   * clicks "Lancer un import" again. Never duplicate an existing QUEUED run.
   * An already-started run is not reusable.
   */
  async findQueuedManual(input:{days:number;countryId?:string|undefined;mode?:"DISCOVERY"|"STAGING"}):
   Promise<{id:string}|null>{
    await this.requireSchema();
    assertImportDays(input.days);
    // Reuse only for explicit single-country selection, not an ambiguous
    // global run whose country set may have changed since enqueue.
    if(!input.countryId)return null;
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      SELECT r.id FROM public.tv_import_run r
      JOIN public.tv_import_scope scope ON scope.run_id=r.id
      WHERE r.trigger='MANUAL' AND r.status='QUEUED'
        AND r.requested_days=${input.days}
        AND (EXISTS (
          SELECT 1 FROM public.tv_import_event e
          WHERE e.run_id=r.id AND e.event_type='RUN_MODE_STAGING'
        ))=${input.mode==="STAGING"}
      GROUP BY r.id
      HAVING count(DISTINCT scope.country_id)=1
         AND min(scope.country_id::text)=${input.countryId}::text
      ORDER BY r.created_at DESC LIMIT 1
    `;
    return rows[0]??null;
  }

  /** Record a worker-start failure without leaving a perpetual QUEUED row.
   * A RUNNING or completed import is never overwritten. This is transactionally
   * restricted to an import that was never claimed by the worker.
   */
  async failUnstartedRun(id:string):Promise<boolean>{
    await this.requireSchema();
    return this.database.prisma.$transaction(async tx=>{
      const changed=await tx.$queryRaw<Array<{id:string}>>`
        UPDATE public.tv_import_run SET status='ERROR',finished_at=now()
        WHERE id=${id}::uuid AND status='QUEUED' RETURNING id
      `;
      if(!changed.length)return false;
      await tx.$executeRaw`
        UPDATE public.tv_import_scope SET status='ERROR',attempts=attempts+1,
          error_message='Worker did not start; previous grid retained'
        WHERE run_id=${id}::uuid AND status='QUEUED'
      `;
      await tx.$executeRaw`
        INSERT INTO public.tv_import_event(run_id,level,event_type,message)
        VALUES(${id}::uuid,'ERROR','START_FAILED',
          'EPG worker could not start; source data was not published')
      `;
      return true;
    });
  }

  /** Remove a non-running import from the admin list without deleting related
   * schedule revisions or fighting FK/immutable provenance triggers. The existing
   * audit event table serves as an append-only administrative tombstone.
   */
  async deleteImport(id:string):Promise<{id:string;deleted:true}>{
    await this.requireSchema();
    return this.database.prisma.$transaction(async tx=>{
      const current=await tx.$queryRaw<Array<{id:string;status:string}>>`
        SELECT id,status FROM public.tv_import_run WHERE id=${id}::uuid FOR UPDATE
      `;
      const row=current[0];
      if(!row)throw new NotFoundException("TV import run not found");
      if(row.status==="RUNNING")throw new ConflictException("TV_IMPORT_RUNNING_CANNOT_DELETE");
      // A queued job has no completed work: physically remove it so a worker
      // cannot claim it after it disappears from the UI.
      if(row.status==="QUEUED"){
        await tx.$executeRaw`
          DELETE FROM public.tv_import_run WHERE id=${id}::uuid AND status='QUEUED'
        `;
        return {id,deleted:true};
      }
      // Completed work remains traceable for data provenance; an audit
      // tombstone removes it from the admin list without mutating TV content.
      await tx.$executeRaw`
        INSERT INTO public.tv_import_event(run_id,level,event_type,message)
        SELECT ${id}::uuid,'INFO','ADMIN_DELETED','Removed from administration'
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tv_import_event
          WHERE run_id=${id}::uuid AND event_type='ADMIN_DELETED'
        )
      `;
      return {id,deleted:true};
    });
  }

  /** Bounded audit history; absent metrics remain absent, not fake zeroes. */
  async listRuns(page:number,pageSize:number){
    await this.requireSchema();
    const offset=(page-1)*pageSize;
    const [items,count]=await Promise.all([
      this.database.prisma.$queryRaw<Array<{
        id:string;trigger:string;requestedDays:number;status:string;createdAt:Date;
        startedAt:Date|null;finishedAt:Date|null;scopeCount:number;
        succeeded:number;failed:number;
      }>>`
        SELECT r.id,r.trigger,r.requested_days AS "requestedDays",r.status,
          r.created_at AS "createdAt",r.started_at AS "startedAt",
          r.finished_at AS "finishedAt",
          count(s.id)::int AS "scopeCount",
          count(s.id) FILTER (WHERE s.status='SUCCESS')::int AS succeeded,
          count(s.id) FILTER (WHERE s.status IN ('ERROR','INTERRUPTED'))::int AS failed
        FROM public.tv_import_run r LEFT JOIN public.tv_import_scope s ON s.run_id=r.id
        WHERE NOT EXISTS (SELECT 1 FROM public.tv_import_event deleted
          WHERE deleted.run_id=r.id AND deleted.event_type='ADMIN_DELETED')
        GROUP BY r.id ORDER BY r.created_at DESC,r.id DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      this.database.prisma.$queryRaw<Array<{total:number}>>`
        SELECT count(*)::int AS total FROM public.tv_import_run r
        WHERE NOT EXISTS (SELECT 1 FROM public.tv_import_event deleted
          WHERE deleted.run_id=r.id AND deleted.event_type='ADMIN_DELETED')`,
    ]);
    return {items,pagination:{page,pageSize,total:count[0]?.total??0,
      totalPages:Math.ceil((count[0]?.total??0)/pageSize)}};
  }
  async getRun(id:string){
    await this.requireSchema();
    const rows=await this.database.prisma.$queryRaw<Array<{id:string;status:string}>>`
      SELECT id,trigger,requested_days AS "requestedDays",status,
        started_at AS "startedAt",finished_at AS "finishedAt",created_at AS "createdAt"
      FROM public.tv_import_run r WHERE r.id=${id}::uuid
        AND NOT EXISTS (SELECT 1 FROM public.tv_import_event deleted
          WHERE deleted.run_id=r.id AND deleted.event_type='ADMIN_DELETED')
    `;
    if(!rows.length)throw new NotFoundException("TV import run not found");
    const scopes=await this.database.prisma.$queryRaw<Array<{id:string;status:string}>>`
      SELECT id,country_id AS "countryId",source_id AS "sourceId",
        status,attempts,error_message AS "errorMessage"
      FROM public.tv_import_scope WHERE run_id=${id}::uuid ORDER BY country_id,source_id,id
    `;
    const drafts=await this.database.prisma.$queryRaw<Array<{
      draftDays:number;draftAirings:number;draftProgrammes:number;
    }>>`
      SELECT count(DISTINCT r.id)::int AS "draftDays",
        count(a.id)::int AS "draftAirings",
        count(DISTINCT a.programme_id)::int AS "draftProgrammes"
      FROM public.tv_schedule_revision r
      LEFT JOIN public.tv_airing a ON a.revision_id=r.id
      WHERE r.run_id=${id}::uuid AND r.status='STAGING'
    `;
    return {...rows[0],scopes,privateDrafts:drafts[0]??{
      draftDays:0,draftAirings:0,draftProgrammes:0,
    }};
  }
  async getEvents(id:string){
    await this.requireSchema();
    return this.database.prisma.$queryRaw`
      SELECT e.id,e.scope_id AS "scopeId",e.occurred_at AS "occurredAt",
        e.level,e.event_type AS "eventType",e.message
      FROM public.tv_import_event e WHERE e.run_id=${id}::uuid
      ORDER BY e.occurred_at DESC,e.id DESC LIMIT 200
    `;
  }
  /** Copy only failed scopes to a NEW run; never reset successful history. */
  async retryFailed(id:string){
    await this.requireSchema();
    return this.database.prisma.$transaction(async tx=>{
      const original=await tx.$queryRaw<Array<{trigger:string;requestedDays:number;status:string}>>`
        SELECT trigger,requested_days AS "requestedDays",status FROM public.tv_import_run
        WHERE id=${id}::uuid FOR UPDATE
      `;
      if(!original[0])throw new NotFoundException("TV import run not found");
      if(!["SUCCESS","PARTIAL","ERROR","INTERRUPTED"].includes(original[0].status))
        throw new ConflictException("TV import run is not finished");
      const staged=await tx.$queryRaw<Array<{present:boolean}>>`
        SELECT EXISTS(SELECT 1 FROM public.tv_import_event
          WHERE run_id=${id}::uuid AND event_type='RUN_MODE_STAGING') AS present
      `;
      const mode=staged[0]?.present?"STAGING" as const:"DISCOVERY" as const;
      const scopes=await tx.$queryRaw<Array<{id:string;countryId:string;sourceId:string|null;status:string}>>`
        SELECT id,country_id AS "countryId",source_id AS "sourceId",status
        FROM public.tv_import_scope WHERE run_id=${id}::uuid FOR UPDATE
      `;
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(241024,87)`;
      const failedIds=failedScopeIds(scopes);
      if(!failedIds.length)throw new ConflictException("No failed scopes to retry");
      const pending=await tx.$queryRaw<Array<{id:string}>>`
        SELECT scope.id FROM public.tv_import_scope scope
        JOIN public.tv_import_run existing ON existing.id=scope.run_id
        WHERE scope.country_id IN (
          SELECT country_id FROM public.tv_import_scope WHERE id::text=ANY(${failedIds}::text[])
        ) AND existing.status IN ('QUEUED','RUNNING')
        LIMIT 1
      `;
      if(pending.length)throw new ConflictException("TV_IMPORT_SCOPE_BUSY");
      const run=await tx.$queryRaw<Array<{id:string}>>`
        INSERT INTO public.tv_import_run(trigger,requested_days,status)
        VALUES('MANUAL',${original[0].requestedDays},'QUEUED') RETURNING id
      `;
      const nextId=run[0]?.id;
      if(!nextId)throw new Error("Failed to create retry");
      for(const s of scopes.filter(s=>failedIds.includes(s.id))){
        await tx.$executeRaw`
          INSERT INTO public.tv_import_scope(run_id,country_id,source_id,status)
          VALUES(${nextId}::uuid,${s.countryId}::uuid,${s.sourceId}::uuid,'QUEUED')
        `;
      }
      await tx.$executeRaw`
        INSERT INTO public.tv_import_event(run_id,level,event_type,message)
        VALUES(${nextId}::uuid,'INFO','RETRY_QUEUED','Only failed previous import scopes queued')
      `;
      if(mode==="STAGING"){
        await tx.$executeRaw`
          INSERT INTO public.tv_import_event(run_id,level,event_type,message)
          VALUES(${nextId}::uuid,'INFO','RUN_MODE_STAGING','Private programme staging; no public schedule')
        `;
      }
      return {id:nextId,fromRunId:id,retried:failedIds.length,mode};
    });
  }
  async finishRun(id:string) {
    await this.requireSchema();
    return this.database.prisma.$transaction(async tx=>{
      const scopes=await tx.$queryRaw<Array<{status:"SUCCESS"|"ERROR"|"INTERRUPTED"|"QUEUED"|"RUNNING"}>>`
        SELECT status FROM public.tv_import_scope WHERE run_id=${id}::uuid FOR UPDATE
      `;
      if(!scopes.length || scopes.some(s=>!["SUCCESS","ERROR","INTERRUPTED"].includes(s.status)))
        throw new ConflictException("Unfinished import scopes");
      const status=deriveRunStatus(scopes.map(s=>s.status as "SUCCESS"|"ERROR"|"INTERRUPTED"));
      await tx.$executeRaw`
        UPDATE public.tv_import_run SET status=${status},finished_at=now()
        WHERE id=${id}::uuid AND status IN ('QUEUED','RUNNING')
      `;
      return {id,status};
    });
  }
}
