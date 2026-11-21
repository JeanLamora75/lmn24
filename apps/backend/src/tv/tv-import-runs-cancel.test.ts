import {describe,expect,it,vi} from "vitest";
import {TvImportRunsService} from "./tv-import-runs.service";
import type {DatabaseService} from "../database/database.service";

const id="92d055fc-8c55-4407-9954-976debd1345b";
function setup(deleted:boolean,existing?:{status:string;trigger:string}){
 const statements:string[]=[];
 const query=vi.fn(async(strings:TemplateStringsArray)=>{
  const sql=strings.join("?");
  statements.push(sql);
  if(sql.includes("to_regclass"))return [{ok:true}];
  if(sql.includes("DELETE FROM public.tv_import_run"))
   return deleted?[{id}]:[];
  if(sql.includes("SELECT status,trigger FROM public.tv_import_run"))
   return existing?[existing]:[];
  throw new Error("Unexpected SQL");
 });
 const service=new TvImportRunsService({prisma:{$queryRaw:query}} as unknown as DatabaseService);
 return {service,statements,query};
}
describe("Cancel queued Guide TV import",()=>{
 it("deletes pending manual import atomically with its DB cascade",async()=>{
  const s=setup(true);
  await expect(s.service.cancelQueued(id)).resolves.toEqual({id,deleted:true});
  expect(s.statements.some(sql=>sql.includes("status='QUEUED'")
   &&sql.includes("trigger='MANUAL'")&&sql.includes("DELETE FROM public.tv_import_run"))).toBe(true);
  expect(s.statements).toHaveLength(2); // only preflight and atomic delete
 });
 it.each(["RUNNING","SUCCESS","ERROR","INTERRUPTED"])(
  "never deletes %s imports or their historical audit",async(status)=>{
   const s=setup(false,{status,trigger:"MANUAL"});
   await expect(s.service.cancelQueued(id)).rejects.toMatchObject({status:409});
   expect(s.statements.some(sql=>sql.includes("DELETE FROM public.tv_import_scope"))).toBe(false);
  });
 it("refuses removal of an automatic import",async()=>{
  const s=setup(false,{status:"QUEUED",trigger:"AUTOMATIC"});
  await expect(s.service.cancelQueued(id)).rejects.toMatchObject({status:409});
 });
 it("reports missing import without removing other data",async()=>{
  const s=setup(false);
  await expect(s.service.cancelQueued(id)).rejects.toMatchObject({status:404});
 });
});
