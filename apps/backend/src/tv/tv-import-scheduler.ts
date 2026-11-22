import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {TvImportRunsService} from "./tv-import-runs.service";
import {TvImportExecutionService} from "./tv-import-execution.service";

/** 04:00 in Europe/Paris, regardless of CET/CEST. */
export function dailyTvImportIsDue(now:Date,hourParis=4):boolean{
 if(!Number.isInteger(hourParis)||hourParis<0||hourParis>23)return false;
 const hour=Number(new Intl.DateTimeFormat("en-GB",{
  timeZone:"Europe/Paris",hour:"2-digit",hourCycle:"h23",
 }).format(now));
 return hour===hourParis;
}

/** Automatically starts a seven-day private EPG refresh once a day.
 * Off by default. Uses the production authorization gates and the existing
 * DB-wide queue lock and per-day idempotence before starting the worker.
 * Never switches public schedule pointers or bypasses rights checks.
 */
@Injectable()
export class TvImportScheduler implements OnModuleInit,OnModuleDestroy {
 private readonly logger=new Logger(TvImportScheduler.name);
 private timer:ReturnType<typeof setInterval>|undefined;
 private inProgress=false;
 constructor(
  private readonly config:ConfigService,
  private readonly runs:TvImportRunsService,
  private readonly execution:TvImportExecutionService,
 ){}
 private enabled():boolean{
  return this.config.get<string>("TV_IMPORT_AUTOMATIC_ENABLED")==="true"
   && this.execution.readiness().ready;
 }
 onModuleInit(){
  if(!this.enabled())return;
  this.timer=setInterval(()=>{void this.tick().catch(error=>this.logFailure(error));},60_000);
  this.timer.unref();
  void this.tick().catch(error=>this.logFailure(error));
 }
 private logFailure(error:unknown){
  this.logger.warn("Automatic TV import skipped or failed: "+(error instanceof Error?error.message:String(error)));
 }
 async tick(now=new Date()):Promise<boolean>{
  if(!this.enabled()||!dailyTvImportIsDue(now)||this.inProgress)return false;
  this.inProgress=true;
  try{
   const run=await this.runs.create({trigger:"AUTOMATIC",days:7,mode:"STAGING"});
   // A previous instance may already have created/started this day's run.
   // Never start it a second time when the idempotence guard returns it.
   if("alreadyScheduled" in run && run.alreadyScheduled)return false;
   await this.execution.startRun(run.id,"STAGING");
   this.logger.log("Automatic TV EPG import started: "+run.id);
   return true;
  }finally{this.inProgress=false;}
 }
}
