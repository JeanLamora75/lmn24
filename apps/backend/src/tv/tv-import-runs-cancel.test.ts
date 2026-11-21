import {describe,expect,it,vi} from "vitest";
import {TvImportRunsService} from "./tv-import-runs.service";
import type {DatabaseService} from "../database/database.service";

const id="92d055fc-8c55-4407-9954-976debd1345b";
function setup(status:string|null){
 const statements:string[]=[];
 const raw=vi.fn(async(strings:TemplateStringsArray)=>{
  const sql=strings.join("?");
  statements.push(sql);
  if(sql.includes("to_regclass"))return [{ok:true}];
  if(sql.includes("SELECT id,status FROM public.tv_import_run"))
   return status?[{id,status}]:[];
  throw new Error("Unexpected query");
 });
 const execute=vi.fn(async(strings:TemplateStringsArray)=>{
  statements.push(strings.join("?"));return 1;
 });
 const transaction=vi.fn(async(fn:(tx:unknown)=>Promise<unknown>)=>
  fn({$queryRaw:raw,$executeRaw:execute}));
 const service=new TvImportRunsService({prisma:{
  $queryRaw:raw,$transaction:transaction,
 }} as unknown as DatabaseService);
 return {service,statements,raw,execute,transaction};
}
describe("Hide completed TV imports from administration",()=>{
 it.each(["QUEUED","SUCCESS","PARTIAL","ERROR","INTERRUPTED"])(
  "archives %s using an audit tombstone without removing TV data",async(status)=>{
   const s=setup(status);
   await expect(s.service.deleteImport(id)).resolves.toEqual({id,deleted:true});
   expect(s.execute).toHaveBeenCalledOnce();
   expect(s.statements.some(sql=>sql.includes("INSERT INTO public.tv_import_event")
    &&sql.includes("'ADMIN_DELETED'"))).toBe(true);
   expect(s.statements.some(sql=>sql.includes("DELETE FROM public.tv_import_run")
    ||sql.includes("DELETE FROM public.tv_programme")
    ||sql.includes("DELETE FROM public.tv_channel"))).toBe(false);
  });
 it("refuses to hide an actively running import",async()=>{
  const s=setup("RUNNING");
  await expect(s.service.deleteImport(id)).rejects.toMatchObject({status:409});
  expect(s.execute).not.toHaveBeenCalled();
 });
 it("does not hide missing imports",async()=>{
  const s=setup(null);
  await expect(s.service.deleteImport(id)).rejects.toMatchObject({status:404});
  expect(s.execute).not.toHaveBeenCalled();
 });
});
