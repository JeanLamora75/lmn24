import {ConflictException,Injectable,Logger,ServiceUnavailableException} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";
import {runAuthorizedTvImport,tvEpgExecutionApproved} from "./tv-import-authorized-runner";
import {noCoverageAttested} from "./tv-epg-loader";

const REQUIRED_FLAGS=[
 "TV_CATALOG_ADMIN_ENABLED","TV_IMPORTS_ENABLED","TV_EPG_NETWORK_ENABLED",
 "TV_MIGRATION_QUALIFIED","TV_EPG_SOURCE_USE_APPROVED",
] as const;

/** Explicit manual launch only. A queued import is never executed by creation alone.
 * Discovery writes only external channel IDs awaiting mapping review.
 * Programme and public schedule publication are disabled by construction.
 */
@Injectable()
export class TvImportExecutionService {
 private readonly logger=new Logger(TvImportExecutionService.name);
 private readonly starting=new Set<string>();
 constructor(private readonly config:ConfigService,private readonly runs:TvImportRunsService){}

 readiness(){
  const env=Object.fromEntries(REQUIRED_FLAGS.map(key=>[key,this.config.get<string>(key)]));
  const missing=REQUIRED_FLAGS.filter(key=>env[key]!=="true");
  return {ready:tvEpgExecutionApproved(env),mode:"DISCOVERY" as const,
   missingFlags:missing,publicPublication:false};
 }

 /** Single-click workflow: validate before queueing, reuse an existing
  * matching pending import, then dispatch the discovery worker immediately.
  * No successful response may describe a merely queued run as started.
  */
 async launchManualImport(input:{days:number;countryId?:string|undefined}){
  if(!this.readiness().ready){
   throw new ServiceUnavailableException(
    "TV_SOURCE_USE_NOT_QUALIFIED: import execution unavailable; no run was created");
  }
  const existing=await this.runs.findQueuedManual(input);
  const run=existing??await this.runs.create({...input,trigger:"MANUAL"});
  try{
   const execution=await this.startDiscovery(run.id);
   return {...execution,reusedPendingRun:!!existing};
  }catch(error){
   // A run already persisted remains available for a future permitted retry;
   // never claim it was started, and never bypass authorization.
   throw error;
  }
 }
 async startDiscovery(runId:string){
  const state=this.readiness();
  if(!state.ready)throw new ServiceUnavailableException(
   "TV_DISCOVERY_EXECUTION_DISABLED: operational approvals missing");
  if(this.starting.has(runId))throw new ConflictException("TV_IMPORT_ALREADY_STARTING");
  // Reserve the run before the first await: concurrent requests in this process
  // must not both pass the status check. The DB writer lease protects replicas.
  this.starting.add(runId);
  let connectionString:string;
  try{
   const current=await this.runs.getRun(runId);
   if(current.status!=="QUEUED")throw new ConflictException("TV_IMPORT_NOT_QUEUED");
   const configured=this.config.get<string>("DATABASE_URL");
   if(!configured)throw new ServiceUnavailableException("TV_DATABASE_CONFIGURATION_MISSING");
   connectionString=configured;
  }catch(error){
   this.starting.delete(runId);
   throw error;
  }
  const env=Object.fromEntries(REQUIRED_FLAGS.map(key=>[key,this.config.get<string>(key)]));
  // The worker owns the database lease. Errors do not disappear into the HTTP
  // response; its transactional run status and event history remain authoritative.
  // The lease/recovery protocol handles interrupted RUNNING work.
  void runAuthorizedTvImport({
   env,connectionString,runId,discoveryOnly:true,attest:noCoverageAttested,
  }).catch(()=>{
   // Source credentials/URLs/stack traces must never appear in admin events/logs.
   this.logger.warn("TV discovery worker could not start or finish; inspect run state");
  }).finally(()=>{this.starting.delete(runId);});
  return {id:runId,status:"STARTED" as const,mode:"DISCOVERY" as const};
 }
}
