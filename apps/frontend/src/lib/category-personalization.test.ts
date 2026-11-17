import { describe, expect, it } from "vitest";
import { orderCategories, personalizeCategories } from "./category-personalization";
import { defaultVisitorPreferences, parseVisitorPreferences, persistVisitorPreferences } from "./visitor-preferences";

const a="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const c="33333333-3333-4333-8333-333333333333";
const items=[{id:a,displayOrder:0},{id:b,displayOrder:1},{id:c,displayOrder:2}];

describe("Visitor category preferences — browser-only ordering and visibility",()=>{
  it("keeps all categories visible in editorial order unless explicitly personalized",()=>{
    expect(personalizeCategories(items,{order:[],hidden:[]})).toEqual(items);
    expect(items.map(x=>x.id)).toEqual([a,b,c]);
  });
  it("moves selected IDs first, hides selected categories and adds new categories by editorial order",()=>{
    expect(personalizeCategories(items,{order:[c,a],hidden:[a]}).map(x=>x.id)).toEqual([c,b]);
    expect(orderCategories(items,[b,a]).map(x=>x.id)).toEqual([b,a,c]);
    expect(personalizeCategories(items,{order:[],hidden:[a,b,c]})).toEqual([]);
  });
  it("retains old version-one preferences without losing birth date or city",()=>{
    const legacy={version:1,theme:"dark",countryIso2:null,city:null,birthDate:"2000-02-29"};
    const parsed=parseVisitorPreferences(legacy);
    expect(parsed).toEqual({...legacy,categories:{order:[],hidden:[]}});
    expect(parseVisitorPreferences({...legacy,categories:{order:[a,b],hidden:[c]}})?.categories)
      .toEqual({order:[a,b],hidden:[c]});
  });
  it("rejects duplicates, arbitrary fields and invalid category IDs",()=>{
    const initial=defaultVisitorPreferences();
    expect(parseVisitorPreferences({...initial,categories:{order:[a,a],hidden:[]}})).toBeNull();
    expect(parseVisitorPreferences({...initial,categories:{order:[],hidden:["not-a-uuid"]}})).toBeNull();
    expect(parseVisitorPreferences({...initial,categories:{order:[],hidden:[], extra:true}})).toBeNull();
  });
  it("persists category changes only via the explicit save transaction",()=>{
    const writes:string[]=[];
    const storage={getItem:()=>null,setItem:(_key:string,value:string)=>{writes.push(value);}};
    const draft={...defaultVisitorPreferences(),categories:{order:[b,a],hidden:[c]}};
    expect(writes).toHaveLength(0);
    expect(persistVisitorPreferences(storage,draft).ok).toBe(true);
    expect(JSON.parse(writes[0]!).categories).toEqual({order:[b,a],hidden:[c]});
  });
});
