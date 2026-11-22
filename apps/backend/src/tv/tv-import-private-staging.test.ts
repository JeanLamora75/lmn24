import {describe,expect,it,vi} from "vitest";
import type {TvWriterLease} from "./tv-import-publisher";
import {stagePrivateTvRevision} from "./tv-import-publisher";

const variantId="a3000000-0000-4000-8000-000000000001";
const countryId="a1000000-0000-4000-8000-000000000001";
const sourceId="a2000000-0000-4000-8000-000000000001";
const programmeId="a4000000-0000-4000-8000-000000000001";
const runId="a5000000-0000-4000-8000-000000000001";
function setup(rights=true){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes("AS allowed"))return {rows:[{allowed:sql.includes("FROM public.tv_source")?rights:true}]};
  if(sql.includes("RETURNING id"))return {rows:[{id:"a6000000-0000-4000-8000-000000000001"}]};
  return {rows:[]};
 });
 const lease={client:{query},ownerToken:"owner",signal:new AbortController().signal,
  release:vi.fn()} as unknown as TvWriterLease;
 const input={variantId,countryId,localDate:"2026-11-21",runId,airings:[{
  programmeId,sourceId,startsAt:"2026-11-21T12:00:00Z",
  endsAt:"2026-11-21T13:00:00Z",fingerprint:"fixture",
 }]};
 return {query,lease,input};
}
describe("Private EPG draft schedule",()=>{
 it("keeps imported airings in STAGING and never changes the public current grid",async()=>{
  const {lease,query,input}=setup();
  await expect(stagePrivateTvRevision(lease,input))
   .resolves.toBe("a6000000-0000-4000-8000-000000000001");
  const sql=query.mock.calls.map(c=>c[0]).join("\n");
  expect(sql).toContain("tv_schedule_revision");
  expect(sql).toContain("'STAGING'");
  expect(sql).toContain("s.programme_rights_status='APPROVED'");
  expect(sql).not.toContain("programme_rights_reference");
  expect(sql).toContain("INSERT INTO public.tv_airing");
  expect(sql).toContain("COMMIT");
  expect(sql).not.toContain("tv_schedule_current");
  expect(sql).not.toContain("'PUBLISHED'");
  expect(sql).not.toContain("'VALIDATED'");
 });
 it("rejects missing source rights and rolls back all draft writes",async()=>{
  const {lease,query,input}=setup(false);
  await expect(stagePrivateTvRevision(lease,input))
   .rejects.toThrow("TV_SOURCE_RIGHTS_NOT_APPROVED");
  const sql=query.mock.calls.map(c=>c[0]).join("\n");
  expect(sql).toContain("ROLLBACK");
  expect(sql).not.toContain("INSERT INTO public.tv_airing");
  expect(sql).not.toContain("tv_schedule_current");
 });
 it("refuses invalid or empty private schedules before beginning a transaction",async()=>{
  const {lease,query,input}=setup();
  await expect(stagePrivateTvRevision(lease,{...input,airings:[]}))
   .rejects.toThrow("Cannot stage empty TV schedule");
  await expect(stagePrivateTvRevision(lease,{...input,localDate:"invalid"}))
   .rejects.toThrow("Invalid local date");
  expect(query).not.toHaveBeenCalled();
 });
});
