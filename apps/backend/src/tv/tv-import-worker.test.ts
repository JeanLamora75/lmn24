import {describe,expect,it,vi,beforeEach} from "vitest";
const fake=vi.hoisted(()=>({
 query:vi.fn(),release:vi.fn(),publish:vi.fn(),recover:vi.fn(),
}));
vi.mock("./tv-import-publisher",()=>({
 acquireTvWriterLease:vi.fn(async()=>({
  client:{query:fake.query},ownerToken:"test",signal:new AbortController().signal,
  release:fake.release,
 })),
 publishTvRevision:fake.publish,
}));
vi.mock("./tv-import-recovery",()=>({
 recoverAbandonedTvRuns:fake.recover,
}));
import {processQueuedTvRun} from "./tv-import-worker";
import type {ValidatedEpgLoader} from "./tv-import-worker";

beforeEach(()=>{
 fake.query.mockReset();fake.release.mockReset();fake.publish.mockReset();fake.recover.mockReset();
 fake.query.mockImplementation(async(sql:string)=>{
  if(sql.includes("UPDATE public.tv_import_run SET status='RUNNING'"))
    return {rowCount:1,rows:[{id:"run"}]};
  if(sql.includes("SELECT id,country_id FROM public.tv_import_scope"))
    return {rows:[{id:"a",country_id:"FR"},{id:"b",country_id:"DE"}]};
  return {rowCount:1,rows:[]};
 });
 fake.publish.mockResolvedValue("new-revision");
});
describe("SCRUM-117 worker partial country failures",()=>{
 it("recovers crashed jobs first, publishes successful country and retains failed country",async()=>{
  const dayStartMs=Date.parse("2026-11-21T00:00:00Z");
  const loader:ValidatedEpgLoader={async loadCountry(countryId,scopeIds){
   if(countryId==="DE")throw new Error("upstream.secret.invalid/private");
   return {
    days:[{countryId,variantId:"variant",localDate:"2026-11-21",
     dayStartMs,dayEndMs:dayStartMs+3600000,expectedRevisionId:"previous",
     candidates:[],coverage:[{sourceId:"safe",startMs:dayStartMs,
      endMs:dayStartMs+3600000,confirmed:true}]}],
    scopeResults:scopeIds.map(scopeId=>({scopeId,outcome:"SUCCESS" as const})),
   };
  }};
  const result=await processQueuedTvRun("isolated-db-url","run",loader);
  expect(fake.recover).toHaveBeenCalledOnce();
  expect(fake.publish).toHaveBeenCalledOnce();
  expect(result.status).toBe("PARTIAL");
  expect(fake.query.mock.calls.some(c=>JSON.stringify(c).includes("upstream.secret.invalid"))).toBe(false);
  expect(fake.query.mock.calls.some(c=>String(c[0]).includes("UPDATE public.tv_import_scope")
    &&String(c[0]).includes("status='ERROR'") &&JSON.stringify(c[1]).includes('"b"'))).toBe(true);
  expect(fake.release).toHaveBeenCalledOnce();
 });
 it("never publishes a country with incomplete coverage",async()=>{
  const now=Date.parse("2026-11-21T00:00:00Z");
  const loader:ValidatedEpgLoader={async loadCountry(countryId,scopeIds){
   return {days:[{countryId,variantId:"variant",localDate:"2026-11-21",dayStartMs:now,
    dayEndMs:now+3600000,expectedRevisionId:null,candidates:[],coverage:[]}],
    scopeResults:scopeIds.map(scopeId=>({scopeId,outcome:"SUCCESS" as const}))};
  }};
  const result=await processQueuedTvRun("isolated","run",loader);
  expect(result.status).toBe("ERROR");
  expect(fake.publish).not.toHaveBeenCalled();
  expect(fake.release).toHaveBeenCalledOnce();
 });
});