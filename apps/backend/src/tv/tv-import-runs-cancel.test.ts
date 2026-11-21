import {describe,expect,it,vi} from "vitest";
import {TvImportRunsService} from "./tv-import-runs.service";
import type {DatabaseService} from "../database/database.service";

const id="92d055fc-8c55-4407-9954-976debd1345b";
function setup(deleted:boolean,existing?:{status:string}){
 const statements:string[]=[];
 const query=vi.fn(async(strings:TemplateStringsArray)=>{
  const sql=strings.join("?");
  statements.push(sql);
  if(sql.includes("to_regclass"))return [{ok:true}];
  if(sql.includes("DELETE FROM public.tv_import_run"))return deleted?[{id}]:[];
  if(sql.includes("SELECT status FROM public.tv_import_run"))return existing?[existing]:[];
  throw new Error("Unexpected SQL");
 });
 const service=new TvImportRunsService({prisma:{$queryRaw:query}} as unknown as DatabaseService);
 return {service,statements};
}
describe("Delete Guide TV import",()=>{
 it("deletes the import with one atomic status-guarded query",async()=>{
  const s=setup(true);
  await expect(s.service.deleteImport(id)).resolves.toEqual({id,deleted:true});
  expect(s.statements.some(sql=>sql.includes("DELETE FROM public.tv_import_run")
   &&sql.includes("status IN")&&sql.includes("'ERROR'")
   &&sql.includes("'QUEUED'"))).toBe(true);
  expect(s.statements).toHaveLength(2);
 });
 it.each(["QUEUED","SUCCESS","PARTIAL","ERROR","INTERRUPTED"])(
  "allows deletion of %s without directly deleting TV data",async(status)=>{
   const s=setup(true,{status});
   await expect(s.service.deleteImport(id)).resolves.toEqual({id,deleted:true});
   expect(s.statements.some(sql=>sql.includes("DELETE FROM public.tv_channel")
    ||sql.includes("DELETE FROM public.tv_programme")
    ||sql.includes("DELETE FROM public.tv_import_scope"))).toBe(false);
  });
 it("rejects deletion of a running import",async()=>{
  const s=setup(false,{status:"RUNNING"});
  await expect(s.service.deleteImport(id)).rejects.toMatchObject({status:409});
 });
 it("rejects an unknown import",async()=>{
  const s=setup(false);
  await expect(s.service.deleteImport(id)).rejects.toMatchObject({status:404});
 });
});
