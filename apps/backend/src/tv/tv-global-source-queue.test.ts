import {describe,expect,it,vi} from "vitest";
import {TvImportRunsService} from "./tv-import-runs.service";
import type {DatabaseService} from "../database/database.service";

describe("Guide TV — sources EPG actives globalement (SCRUM-116/117)",()=>{
 it("met en file une source active sans association pays préalable",async()=>{
  const sqlSeen:string[]=[];
  const query=vi.fn(async(strings:TemplateStringsArray)=>{
   const sql=strings.join("?");
   sqlSeen.push(sql);
   if(sql.includes("to_regclass"))return [{ok:true}];
   if(sql.includes('FROM public.tv_country'))return [{countryId:"a1000000-0000-4000-8000-000000000001"}];
   if(sql.includes("FROM public.tv_import_scope scope"))return [];
   if(sql.includes("INSERT INTO public.tv_import_run"))return [{id:"b1000000-0000-4000-8000-000000000001"}];
   if(sql.includes("SELECT s.id AS"))return [{sourceId:"c1000000-0000-4000-8000-000000000001"}];
   if(sql.includes("count(*)::int AS n"))return [{n:1}];
   return [];
  });
  const execute=vi.fn(async()=>1);
  const tx={$queryRaw:query,$executeRaw:execute};
  const prisma={$queryRaw:query,$transaction:vi.fn(async(fn:(t:typeof tx)=>Promise<unknown>)=>fn(tx))};
  const service=new TvImportRunsService({prisma} as unknown as DatabaseService);
  const result=await service.create({trigger:"MANUAL",days:7});
  expect(result).toMatchObject({status:"QUEUED",scopeCount:1});
  expect(execute).toHaveBeenCalledTimes(2); // one source scope + one audit event
  const selection=sqlSeen.find(s=>s.includes("SELECT s.id AS"));
  expect(selection).toContain("LEFT JOIN public.tv_source_country");
  expect(selection).toContain("WHERE s.is_active");
  expect(selection).toContain("(sc.source_id IS NULL OR sc.is_active)");
  expect(sqlSeen.some(s=>s.includes("INSERT INTO public.tv_import_scope"))).toBe(false);
 });
});
