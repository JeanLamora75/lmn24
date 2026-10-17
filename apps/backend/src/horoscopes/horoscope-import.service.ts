import { fencedParserWrite } from "@lmn24/database";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { DatabaseService } from "../database/database.service";
import { validateHoroscopeJson } from "./horoscope-import.validation";

const FILE_RE=/^horoscopes-\d{4}-\d{2}-\d{2}\.json$/;
@Injectable()
export class HoroscopeImportService {
  private readonly logger = new Logger(HoroscopeImportService.name);
  private readonly storage: string;
  constructor(private readonly db:DatabaseService,config:ConfigService) {
    this.storage=path.resolve(config.get<string>("HOROSCOPE_STORAGE_PATH")?.trim() || "../../data/horoscopes");
  }
  async files() {
    let names:string[];
    try {names=await fs.readdir(this.storage);}
    catch(e) {if ((e as NodeJS.ErrnoException).code==="ENOENT") return []; throw e;}
    return names.filter(n=>FILE_RE.test(n)).sort();
  }
  async overview() {
    const files = await this.files();
    const names = files.map(fileName => ({
      fileName, date: fileName.slice(11, 21),
    }));
    const dates = names.map(item => new Date(item.date + "T00:00:00.000Z"));
    const [rows, runs] = await Promise.all([
      this.db.prisma.horoscope.findMany({
        where: {date: {in: dates}},
        select: {date:true,sign:true,languageIsoCode2:true},
      }),
      this.db.prisma.horoscopeImportRun.findMany({
        where: {sourceFile: {in: files}},
        orderBy: {startedAt:"desc"},
        select:{sourceFile:true,status:true,startedAt:true,errorMessage:true},
      }),
    ]);
    return names.map(item => {
      const existing = rows.filter(row=>row.date.toISOString().slice(0,10)===item.date);
      const combinations = new Set(existing.map(row=>row.sign+":"+row.languageIsoCode2));
      const latest = runs.find(run=>run.sourceFile===item.fileName);
      const count=combinations.size;
      return {...item, count, expected:96,
        status:count===96?"IMPORTED":count>0?"PARTIAL":latest?.status==="ERROR"?"ERROR":"PENDING",
        lastImportAt:latest?.startedAt??null,error:latest?.status==="ERROR"?latest.errorMessage:null,
      };
    });
  }
  async preview(fileName:string,sign:string,language:string) {
    if(!FILE_RE.test(fileName))throw new BadRequestException("Fichier invalide.");
    const content=await fs.readFile(path.join(this.storage,fileName),"utf8");
    const parsed=validateHoroscopeJson(content,fileName);
    const item=parsed.data.horoscopes.find(row=>row.sign===sign&&row.language===language);
    if(!item)throw new NotFoundException("Horoscope introuvable.");
    return item;
  }
  async history() {
    return this.db.prisma.horoscopeImportRun.findMany({take:100,orderBy:{startedAt:"desc"}});
  }
  /**
   * Scheduled entry point (SCRUM-88): reuse the manual repository import
   * with identical JSON validation, idempotency and global serialization.
   * Dispatcher calls this method only after 06:00 Europe/Paris.
   * Process a maximum of one missing date per call to keep runs bounded.
   */
  async importScheduledAvailable() {
    const files=await this.overview();
    // At 06:15 Paris time the scheduled import must serve the current civil
    // day. Other files from previous or future dates cannot satisfy it.
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",
    }).formatToParts(new Date());
    const part=(name:string)=>parts.find(item=>item.type===name)?.value??"";
    const today=part("year")+"-"+part("month")+"-"+part("day");
    const expectedFile="horoscopes-"+today+".json";
    const target=files.find(file=>file.fileName===expectedFile);
    if(!target)throw new NotFoundException("Fichier Horoscope attendu absent : "+expectedFile);
    if(target.count===target.expected)
      return {status:"SKIPPED" as const,reason:"Horoscope du jour déjà importé"};
    const result=await this.importFile(target.fileName);
    return {...result,fileName:target.fileName};
  }

  async importFile(fileName:string,userId?:string) {
    if(!FILE_RE.test(fileName)) throw new BadRequestException("Nom de fichier invalide.");
    let content:string;
    try {content=await fs.readFile(path.join(this.storage,fileName),"utf8");}
    catch(e) {if((e as NodeJS.ErrnoException).code==="ENOENT")throw new NotFoundException("Fichier introuvable.");throw e;}
    return this.importContent(content,fileName,userId,"REPOSITORY");
  }
  async importContent(content:string,fileName:string,userId:string|undefined,sourceType:"UPLOAD"|"REPOSITORY"="UPLOAD") {
    // Same two-key advisory lock as apps/parser/src/global-parser-lock.ts.
    // The dedicated session lives for the *entire* database import, not only
    // for its opening transaction. Both manual upload and repository imports
    // pass this single entry point.
    const connectionString=process.env.DATABASE_URL;
    if(!connectionString)throw new Error("DATABASE_URL requise pour l'import.");
    const session=new Client({connectionString,connectionTimeoutMillis:10000});
    let acquired=false;
    const ownerToken=randomUUID();
    let intentionalClose=false;
    let probeStartedAt=0;
    const probeState:{timer?:ReturnType<typeof setInterval>}={};
    const failClosed=()=>{
      if(!intentionalClose && acquired){
        if(probeState.timer)clearInterval(probeState.timer);
        this.logger.error("Horoscope: verrou global perdu; arrêt du backend pour éviter un import concurrent.");
        process.exit(1);
      }
    };
    session.on("error",failClosed);
    session.on("end",failClosed);
    try {
      await session.connect();
      const lock=await session.query<{acquired:boolean}>(
        "SELECT pg_try_advisory_lock($1, $2) AS acquired",[241024,85]);
      if(lock.rows[0]?.acquired!==true)
        throw new ConflictException("Un autre parser est déjà en cours d'exécution.");
      acquired=true;
      // Atomic owner rotation waits for all earlier fenced write transactions.
      await session.query("BEGIN");
      try {
        await session.query("SELECT pg_advisory_xact_lock($1,$2)",[241024,86]);
        await session.query(
          "INSERT INTO parser_write_epoch(singleton_id,owner_token,lock_backend_pid,updated_at) VALUES(1,$1::uuid,pg_backend_pid(),NOW()) ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,lock_backend_pid=EXCLUDED.lock_backend_pid,updated_at=NOW()",
          [ownerToken],
        );
        await session.query("COMMIT");
      } catch(error) {
        await session.query("ROLLBACK").catch(()=>undefined);
        throw error;
      }
      // Proactively detect a lost idle TCP session while the Prisma importer
      // writes on a different pooled connection. Never overlap probes.
      probeState.timer=setInterval(()=>{
        if(intentionalClose)return;
        if(probeStartedAt){
          if(Date.now()-probeStartedAt>10_000)failClosed();
          return;
        }
        probeStartedAt=Date.now();
        void session.query("SELECT 1").catch(failClosed).finally(()=>{probeStartedAt=0;});
      },5_000);
      probeState.timer.unref();
      return await this.importContentLocked(content,fileName,userId,sourceType,ownerToken);
    } finally {
      intentionalClose=true;
      if(probeState.timer)clearInterval(probeState.timer);
      try {
        if(acquired)await session.query("SELECT pg_advisory_unlock($1, $2)",[241024,85]);
      } finally {
        session.off("error",failClosed);
        session.off("end",failClosed);
        await session.end().catch(()=>undefined);
      }
    }
  }

  private async importContentLocked(content:string,fileName:string,userId:string|undefined,sourceType:"UPLOAD"|"REPOSITORY",ownerToken:string) {
    if(!FILE_RE.test(fileName))throw new BadRequestException("Nom de fichier invalide.");
    // Validate before any published content is written.
    let validated:ReturnType<typeof validateHoroscopeJson>;
    try {validated=validateHoroscopeJson(content,fileName);}
    catch(e) {
      const message=e instanceof Error?e.message:"Fichier invalide.";
      await fencedParserWrite(this.db.prisma,ownerToken,tx=>tx.horoscopeImportRun.create({data:{
        sourceType,sourceFile:fileName,status:"ERROR",itemsExpected:96,itemsErrored:96,
        errorMessage:message,...(userId ? {triggeredByUserId:userId} : {}),finishedAt:new Date(),
      }}));
      throw new BadRequestException(message);
    }
    const {data,fingerprint}=validated;
    const date=new Date(data.date+"T00:00:00.000Z");
    const run=await fencedParserWrite(this.db.prisma,ownerToken,tx=>tx.horoscopeImportRun.create({data:{
      sourceType,sourceFile:fileName,fileFingerprint:fingerprint,targetDate:date,...(userId ? {triggeredByUserId:userId} : {}),
      itemsExpected:96,itemsValid:96,status:"RUNNING",
    }}));
    try {
      const result=await this.db.prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT assert_parser_write_epoch(${ownerToken}::uuid)`;
        // A PostgreSQL advisory lock serializes all writers to the same civil date.
        await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${data.date}))`;
        const existing=await tx.horoscope.findMany({where:{date},select:{sign:true,languageIsoCode2:true,sourceFingerprint:true}});
        const current=new Set(existing.map(x=>x.sign+":"+x.languageIsoCode2));
        if(existing.some(x=>x.sourceFingerprint!==fingerprint))
          throw new ConflictException("Date déjà publiée depuis un fichier différent : remplacement interdit.");
        const missing=data.horoscopes.filter(x=>!current.has(x.sign+":"+x.language));
        let snapshot=await tx.horoscopeAstronomySnapshot.findUnique({where:{date}});
        if(snapshot && snapshot.sourceFingerprint!==fingerprint)
          throw new ConflictException("Métadonnées de cette date déjà publiées depuis une autre version.");
        if(!snapshot) snapshot=await tx.horoscopeAstronomySnapshot.create({data:{
          date,generatedAt:new Date(data.generatedAt),timezone:data.timezone,
          astronomy:JSON.parse(JSON.stringify(data.astronomy)),sourceFile:fileName,sourceFingerprint:fingerprint,
        }});
        if(missing.length)await tx.horoscope.createMany({data:missing.map(x=>({
          date,sign:x.sign,languageIsoCode2:x.language,general:x.general,love:x.love,
          work:x.work,finance:x.finance,disclaimer:x.disclaimer,
          sourceFile:fileName,sourceFingerprint:fingerprint,astronomySnapshotId:snapshot.id,
        }))});
        return {inserted:missing.length,skipped:96-missing.length};
      });
      await fencedParserWrite(this.db.prisma,ownerToken,tx=>tx.horoscopeImportRun.update({where:{id:run.id},data:{
        status:result.inserted?"SUCCESS":"SKIPPED",itemsInserted:result.inserted,
        itemsSkipped:result.skipped,finishedAt:new Date(),
      }}));
      return {date:data.date,...result,status:result.inserted?"SUCCESS":"SKIPPED"};
    }catch(e){
      this.logger.error(`Horoscope import failed: ${fileName}`, e instanceof Error ? e.stack : String(e));
      await fencedParserWrite(this.db.prisma,ownerToken,tx=>tx.horoscopeImportRun.update({where:{id:run.id},data:{
        status:"ERROR",errorMessage:e instanceof ConflictException?e.message:"Échec technique d'import.",
        finishedAt:new Date(),
      }}));
      throw e;
    }
  }
}
