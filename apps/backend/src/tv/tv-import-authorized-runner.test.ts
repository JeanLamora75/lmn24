import {describe,expect,it} from "vitest";
import {tvEpgExecutionApproved,tvLocalDiscoveryApproved,runAuthorizedTvImport} from "./tv-import-authorized-runner";
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
 it("allows admin-initiated local discovery only on a development localhost lmn24 database",()=>{
  const dev={NODE_ENV:"development",TV_CATALOG_ADMIN_ENABLED:"true",TV_IMPORTS_ENABLED:"true",
   TV_PUBLIC_ENABLED:"false",TV_PUBLIC_RELEASE_APPROVED:"false"};
  const local="postgresql://user:password@localhost:5432/lmn24";
  expect(tvLocalDiscoveryApproved(dev,local)).toBe(true);
  for(const url of ["postgresql://u:p@remote.example.com/lmn24",
   "postgresql://u:p@localhost/lmn24_prod","http://localhost/lmn24"]){
   expect(tvLocalDiscoveryApproved(dev,url)).toBe(false);
  }
  expect(tvLocalDiscoveryApproved({...dev,NODE_ENV:"production"},local)).toBe(false);
  expect(tvLocalDiscoveryApproved({...dev,TV_PUBLIC_ENABLED:"true"},local)).toBe(false);
  expect(tvLocalDiscoveryApproved({...dev,TV_PUBLIC_RELEASE_APPROVED:"true"},local)).toBe(false);
  expect(tvLocalDiscoveryApproved({...dev,TV_IMPORTS_ENABLED:"false"},local)).toBe(false);
 });
 it("refuses requests before touching production or network",async()=>{
  const transport=async()=>{throw new Error("Must never be called");};
  await expect(runAuthorizedTvImport({env:{},connectionString:"never-connect",
    runId:"never-use",attest:async()=>[],transport}))
    .rejects.toMatchObject({status:503});
 });
});