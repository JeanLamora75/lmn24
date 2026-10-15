import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DatabaseService } from "../database/database.service";
import { validateHoroscopeJson } from "./horoscope-import.validation";

const FILE_RE=/^horoscopes-\d{4}-\d{2}-\d{2}\.json$/;
@Injectable()
export class HoroscopeImportService {
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
  async importFile(fileName:string,userId:string) {
    if(!FILE_RE.test(fileName)) throw new BadRequestException("Nom de fichier invalide.");
    let content:string;
    try {content=await fs.readFile(path.join(this.storage,fileName),"utf8");}
    catch(e) {if((e as NodeJS.ErrnoException).code==="ENOENT")throw new NotFoundException("Fichier introuvable.");throw e;}
    return this.importContent(content,fileName,userId,"REPOSITORY");
  }
  async importContent(content:string,fileName:string,userId:string,sourceType:"UPLOAD"|"REPOSITORY"="UPLOAD") {
    if(!FILE_RE.test(fileName))throw new BadRequestException("Nom de fichier invalide.");
    // Validate before any published content is written.
    let validated:ReturnType<typeof validateHoroscopeJson>;
    try {validated=validateHoroscopeJson(content,fileName);}
    catch(e) {
      const message=e instanceof Error?e.message:"Fichier invalide.";
      await this.db.prisma.horoscopeImportRun.create({data:{
        sourceType,sourceFile:fileName,status:"ERROR",itemsExpected:96,itemsErrored:96,
        errorMessage:message,triggeredByUserId:userId,finishedAt:new Date(),
      }});
      throw new BadRequestException(message);
    }
    const {data,fingerprint}=validated;
    const date=new Date(data.date+"T00:00:00.000Z");
    const run=await this.db.prisma.horoscopeImportRun.create({data:{
      sourceType,sourceFile:fileName,fileFingerprint:fingerprint,targetDate:date,triggeredByUserId:userId,
      itemsExpected:96,itemsValid:96,status:"RUNNING",
    }});
    try {
      const result=await this.db.prisma.$transaction(async tx=>{
        // A PostgreSQL advisory lock serializes all writers to the same civil date.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.date}))`;
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
      await this.db.prisma.horoscopeImportRun.update({where:{id:run.id},data:{
        status:result.inserted?"SUCCESS":"SKIPPED",itemsInserted:result.inserted,
        itemsSkipped:result.skipped,finishedAt:new Date(),
      }});
      return {date:data.date,...result,status:result.inserted?"SUCCESS":"SKIPPED"};
    }catch(e){
      await this.db.prisma.horoscopeImportRun.update({where:{id:run.id},data:{
        status:"ERROR",errorMessage:e instanceof ConflictException?e.message:"Échec technique d'import.",
        finishedAt:new Date(),
      }});
      throw e;
    }
  }
}
