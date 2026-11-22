import {describe,expect,it,vi} from "vitest";
import {TvPublicService} from "./tv-public.service";
import {DatabaseService} from "../database/database.service";

const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const country="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const channel=(id:string,variantId:string,name:string,number:number)=>({
 id,channelId:id,name,number,logoUrl:null,countryId:country,countryIso2:"FR",
 referenceTimeZone:"Europe/Paris",defaultVariantId:variantId,variantId,
 variantTimeZone:"Europe/Paris",broadcastLanguages:[],
});
const airing=(id:string,variantId:string,startsAt:string,endsAt:string)=>({
 id,variantId,sourceId:country,startsAt,endsAt,title:id,
 category:null,description:null,imageUrl:null,
});

function setup(){
 const statements:{sql:string;params:readonly unknown[]}[]=[];
 const query=vi.fn().mockImplementation(async (parts:TemplateStringsArray,...params:unknown[])=>{
  const sql=parts.join("?");
  statements.push({sql,params});
  if(sql.includes("to_regclass("))return [{ready:true}];
  if(sql.includes('AS "isoCode2"')&&sql.includes("LIMIT 1"))
   return [{id:country,isoCode2:"FR",referenceTimeZone:"Europe/Paris"}];
  if(sql.includes('AS "broadcastLanguages"'))
   return [channel(a,a,"France A",2),channel(b,b,"France B",3)];
  if(sql.includes("WITH latest AS"))
   return [
    airing("prime",a,"2026-11-24T20:10:00.000Z","2026-11-24T22:30:00.000Z"),
    airing("late",a,"2026-11-24T21:45:00.000Z","2026-11-24T23:00:00.000Z"),
    airing("other",b,"2026-11-24T19:40:00.000Z","2026-11-24T21:30:00.000Z"),
   ];
  throw new Error("Unexpected SQL: "+sql.slice(0,100));
 });
 const db={prisma:{$queryRaw:query}} as unknown as DatabaseService;
 return {service:new TvPublicService(db),statements};
}
describe("TV schedule performance without editorial changes",()=>{
 it("groups airings by variant, preserving late-window starts over ongoing prime time",async()=>{
  const {service,statements}=setup();
  const result=await service.schedule({
   country:"FR",localDate:"2026-11-24",tab:"LATE",
   page:1,pageSize:100,now:new Date("2026-11-22T14:00:00Z"),
  });
  expect(result.items).toHaveLength(2);
  expect(result.items[0]?.airing?.id).toBe("late");
  expect(result.items[1]?.airing).toBeNull();
  const statement=statements.find(x=>x.sql.includes("WITH latest AS"));
  expect(statement).toBeDefined();
  expect(statement?.sql).toContain("r.variant_id=ANY(?::uuid[])");
  expect(statement?.sql).toContain("JOIN public.tv_airing a ON a.revision_id=latest.id");
  expect(statement?.sql).not.toContain("NOT EXISTS (SELECT 1 FROM public.tv_schedule_revision newer");
  expect(statement?.sql).not.toContain("r.variant_id::text");
  // A future date must not expand the SQL scan back to today's airings.
  expect(statement?.params.some(p=>p==="2026-11-21")).toBe(true);
  expect(statement?.params.some(p=>p==="2026-11-27")).toBe(true);
 });
 it("keeps tonight's program independent per variant",async()=>{
  const {service}=setup();
  const result=await service.schedule({
   country:"FR",localDate:"2026-11-24",tab:"TONIGHT",
   page:1,pageSize:100,now:new Date("2026-11-22T14:00:00Z"),
  });
  expect(result.items[0]?.airing?.id).toBe("prime");
  expect(result.items[1]?.airing?.id).toBe("other");
 });
});
