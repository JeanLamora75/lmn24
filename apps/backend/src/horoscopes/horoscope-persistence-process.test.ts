import { afterAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lmn24/database";
import { HoroscopeImportService } from "./horoscope-import.service";
import { HOROSCOPE_LOCALES, HOROSCOPE_SIGNS } from "./public-horoscopes.service";

const enabled=process.env.SCHEDULER_PG_INTEGRATION==="1" && !!process.env.DATABASE_URL;
const db=enabled?createPrismaClient():undefined;
const date="2038-11-07";
const fileName="horoscopes-"+date+".json";
const document=JSON.stringify({
  date,generatedAt:"2038-11-06T13:00:00+01:00",timezone:"Europe/Paris",
  astronomy:{validationStatus:"VALID",attribution:{
    text:"Fixture astronomy (non-published test)",url:"https://example.test/astrology",
  }},
  horoscopes:HOROSCOPE_SIGNS.flatMap(sign=>HOROSCOPE_LOCALES.map(language=>({
    date,sign,language,general:"Météo astrale simulée",love:"Relation test",
    work:"Carrière test",finance:"Budget test",disclaimer:"Pour divertissement uniquement",
  }))),
});
afterAll(async()=>{await db?.$disconnect();});

describe.skipIf(!enabled)("actual Horoscope importer persistence on isolated PostgreSQL",()=>{
  it("persists 96 sign-language rows, snapshot and audit run then idempotently skips replay",async()=>{
    if(!db)throw new Error("Test database required");
    for(const code of HOROSCOPE_LOCALES){
      await db.$executeRaw`INSERT INTO language(iso_code2) VALUES(${code}) ON CONFLICT DO NOTHING`;
    }
    const service=new HoroscopeImportService({prisma:db} as never,{get:()=>undefined} as never);
    const runDate=new Date(date+"T00:00:00.000Z");
    try{
      const first=await service.importContent(document,fileName,undefined,"REPOSITORY");
      expect(first).toMatchObject({status:"SUCCESS",inserted:96,skipped:0});
      const rows=await db.horoscope.findMany({where:{date:runDate}});
      expect(rows).toHaveLength(96);
      expect(new Set(rows.map(row=>row.sign+":"+row.languageIsoCode2)).size).toBe(96);
      expect(await db.horoscopeAstronomySnapshot.count({where:{date:runDate}})).toBe(1);
      const second=await service.importContent(document,fileName,undefined,"REPOSITORY");
      expect(second).toMatchObject({status:"SKIPPED",inserted:0,skipped:96});
      expect(await db.horoscope.count({where:{date:runDate}})).toBe(96);
      const audit=await db.horoscopeImportRun.findMany({where:{sourceFile:fileName},orderBy:{startedAt:"asc"}});
      expect(audit.map(x=>x.status)).toEqual(["SUCCESS","SKIPPED"]);
    }finally{
      await db.horoscope.deleteMany({where:{date:runDate}});
      await db.horoscopeAstronomySnapshot.deleteMany({where:{date:runDate}});
      await db.horoscopeImportRun.deleteMany({where:{sourceFile:fileName}});
    }
  },40_000);
});
