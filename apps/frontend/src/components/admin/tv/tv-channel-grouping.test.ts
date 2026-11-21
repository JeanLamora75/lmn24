import {describe,expect,it} from "vitest";
import {groupTvChannels,tvChannelDisplayKey} from "./tv-channel-grouping";

const row=(id:string,countryId:string,name:string,logoUrl:string|null=null)=>({
 id,countryId,name,logoUrl,websiteUrl:null,isActive:false,needsReview:true,effectiveNumber:null,
});
describe("TV channel display duplicates",()=>{
 it("groups capitalization and whitespace differences within the same country",()=>{
  const result=groupTvChannels([
   row("a","FR","13ème rue"),
   row("b","FR","13ème Rue","/tv-icons/logo.png"),
   row("c","FR","  13ème   RUE "),
  ]);
  expect(result.representatives).toHaveLength(1);
  expect(result.representatives[0]?.id).toBe("b");
  expect(result.members.get(tvChannelDisplayKey(result.representatives[0]!))?.map(x=>x.id))
   .toEqual(["a","b","c"]);
 });
 it("never groups equal channel names belonging to different countries",()=>{
  expect(groupTvChannels([row("a","FR","TV One"),row("b","BE","tv one")])
   .representatives).toHaveLength(2);
 });
 it("does not merge distinct names or alter source records",()=>{
  const originals=[row("a","FR","TV One"),row("b","FR","TV One HD")];
  const result=groupTvChannels(originals);
  expect(result.representatives).toHaveLength(2);
  expect(originals[0]?.name).toBe("TV One");
 });
});
