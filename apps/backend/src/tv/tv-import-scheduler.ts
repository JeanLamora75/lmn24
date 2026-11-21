import { Injectable,OnModuleDestroy,OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TvImportRunsService } from "./tv-import-runs.service";

export function dailyTvImportIsDue(now:Date,hourUtc=3):boolean{
  return Number.isInteger(hourUtc)&&hourUtc>=0&&hourUtc<=23&&
    now.getUTCHours()===hourUtc;
}
/** Schedules daily imports, but does NOT download or run them.
 * Default OFF: requires deliberate operational authorization of all flags,
 * and the canonical TV schema qualification from SCRUM-114.
 */
@Injectable()
export class TvImportScheduler implements OnModuleInit,OnModuleDestroy {
  private timer:ReturnType<typeof setInterval>|undefined;
  private inProgress=false;
  constructor(private readonly config:ConfigService,private readonly runs:TvImportRunsService){}
  private enabled(){
    return this.config.get<string>("TV_IMPORTS_ENABLED")==="true"
      && this.config.get<string>("TV_CATALOG_ADMIN_ENABLED")==="true"
      && this.config.get<string>("TV_IMPORT_AUTOMATIC_ENABLED")==="true";
  }
  onModuleInit(){
    if(!this.enabled())return;
    // Do not rely on a single-process scheduler: the DB queue locks and
    // per-UTC-day idempotence handle multiple backend replicas.
    this.timer=setInterval(()=>{void this.tick().catch(()=>undefined);},60_000);
    this.timer.unref();
    void this.tick().catch(()=>undefined);
  }
  async tick(now=new Date()):Promise<boolean>{
    if(!this.enabled()||!dailyTvImportIsDue(now)||this.inProgress)return false;
    this.inProgress=true;
    try{
      await this.runs.create({trigger:"AUTOMATIC",days:7});
      return true;
    }finally{this.inProgress=false;}
  }
  onModuleDestroy(){
    if(this.timer)clearInterval(this.timer);
    this.timer=undefined;
  }
}
