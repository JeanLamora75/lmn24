import {ConflictException,Injectable,Logger,ServiceUnavailableException} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";
import {runAuthorizedTvImport,tvEpgExecutionApproved,tvLocalDiscoveryApproved} from "./tv-import-authorized-runner";
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

 private executionEnvironment():Record<string,string|undefined>{
  return {...Object.fromEntries(REQUIRED_FLAGS.map(key=>[key,this.config.get<string>(key)])),
   NODE_ENV:process.env.NODE_ENV,
   TV_PUBLIC_ENABLED:this.config.get<string>("TV_PUBLIC_ENABLED"),
   TV_PUBLIC_RELEASE_APPROVED:this.config.get<string>("TV_PUBLIC_RELEASE_APPROVED")};
 }
 readiness(){
  const env=this.executionEnvironment();
  const connectionString=this.config.get<string>("DATABASE_URL")??"";
  const local=tvLocalDiscoveryApproved(env,connectionString);
  const missing=REQUIRED_FLAGS.filter(key=>env[key]!=="true");
  return {ready:local||tvEpgExecutionApproved(env),mode:"DISCOVERY" as const,
   missingFlags:local?[]:missing,publicPublication:false};
 }

 /** Single-click workflow: validate before queueing, reuse an existing
  * matching pending import, then dispatch the discovery worker immediately.
  * No successful response may describe a merely queued run as started.
  */
 async launchManualImport(input:{days:number;countryId?:string|undefined;mode?:"DISCOVERY"|"STAGING"|undefined}){
  if(!this.readiness().ready){
   throw new ServiceUnavailableException(
    "TV_SOURCE_USE_NOT_QUALIFIED: import execution unavailable; no run was created");
  }
  const existing=await this.runs.findQueuedManual(input);
  const run=existing??await this.runs.create({...input,trigger:"MANUAL"});
  try{
   const execution=await this.startRun(run.id,input.mode??"DISCOVERY");
   return {...execution,reusedPendingRun:!!existing};
  }catch(error){
   // A run already persisted remains available for a future permitted retry;
   // never claim it was started, and never bypass authorization.
   throw error;
  }
 }
 /** Retry exactly the failed scopes and immediately dispatch their worker.
  * A server-side preflight prevents creating a second stranded QUEUED run.
  */
 async retryFailedImport(originalRunId:string){
  if(!this.readiness().ready)throw new ServiceUnavailableException(
   "TV_SOURCE_USE_NOT_QUALIFIED: retry execution unavailable");
  const next=await this.runs.retryFailed(originalRunId);
  const execution=await this.startRun(next.id,next.mode??"DISCOVERY");
  return {...execution,fromRunId:originalRunId,retried:next.retried};
 }
 async startDiscovery(runId:string){return this.startRun(runId,"DISCOVERY");}
 async startRun(runId:string,mode:"DISCOVERY"|"STAGING"){
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
  const env=this.executionEnvironment();
  // The worker owns the database lease. Errors do not disappear into the HTTP
  // response; its transactional run status and event history remain authoritative.
  // The lease/recovery protocol handles interrupted RUNNING work.
  void runAuthorizedTvImport({
   env,connectionString,runId,discoveryOnly:mode==="DISCOVERY",
   stagingOnly:mode==="STAGING",attest:noCoverageAttested,
  }).catch(async()=>{
   // A pre-start failure is stored as ERROR rather than leaving QUEUED forever.
   // If the worker already claimed RUNNING, the guarded update does nothing.
   try{await this.runs.failUnstartedRun(runId);}catch{/* Database may be offline. */}
   this.logger.warn("TV discovery worker failed; inspect run status and events");
  }).finally(()=>{this.starting.delete(runId);});
  return {id:runId,status:"STARTED" as const,mode};
 }
}
