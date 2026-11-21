import {describe,expect,it} from "vitest";
import {tvEpgExecutionApproved,runAuthorizedTvImport} from "./tv-import-authorized-runner";
const approved={
 TV_CATALOG_ADMIN_ENABLED:"true",TV_IMPORTS_ENABLED:"true",
 TV_EPG_NETWORK_ENABLED:"true",TV_MIGRATION_QUALIFIED:"true",
 TV_EPG_SOURCE_USE_APPROVED:"true",
};
describe("SCRUM-117 EPG runtime executes only after separate approvals",()=>{
 it("requires all five explicit operational approvals",()=>{
  expect(tvEpgExecutionApproved({})).toBe(false);
  for(const key of Object.keys(approved)){
   expect(tvEpgExecutionApproved({...approved,[key]:"false"}),key).toBe(false);
  }
  expect(tvEpgExecutionApproved(approved)).toBe(true);
  expect(tvEpgExecutionApproved({...approved,TV_IMPORT_AUTOMATIC_ENABLED:"false"})).toBe(true);
 });
 it("refuses requests before touching production or network",async()=>{
  const transport=async()=>{throw new Error("Must never be called");};
  await expect(runAuthorizedTvImport({env:{},connectionString:"never-connect",
    runId:"never-use",attest:async()=>[],transport}))
    .rejects.toMatchObject({status:503});
 });
});