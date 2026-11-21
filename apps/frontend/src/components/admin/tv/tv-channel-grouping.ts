/** The catalog can have several EPG identities for one displayed country/name.
 * Group for review only. Never merge IDs, sources, variants or programme data.
 */
export type TvChannelGroupingRow={
 id:string;countryId:string;name:string;logoUrl:string|null;
 websiteUrl:string|null;isActive:boolean;needsReview:boolean;
 effectiveNumber:number|null;
};
export function tvChannelDisplayKey(row:Pick<TvChannelGroupingRow,"countryId"|"name">):string{
 return row.countryId+"|"+row.name.normalize("NFKC").trim().replace(/\\s+/g," ").toLocaleLowerCase("fr");
}
export function groupTvChannels<T extends TvChannelGroupingRow>(rows:readonly T[]):{
 representatives:T[];members:Map<string,T[]>;
}{
 const members=new Map<string,T[]>();
 for(const row of rows){
  const key=tvChannelDisplayKey(row);
  const entries=members.get(key)??[];
  entries.push(row);
  members.set(key,entries);
 }
 // Prefer established manually configured records to imported placeholders.
 // This is a display choice, never a persisted canonical identity.
 const score=(row:T)=>Number(row.isActive)*16+Number(!row.needsReview)*8+
  Number(row.effectiveNumber!==null)*4+Number(!!row.logoUrl)*2+Number(!!row.websiteUrl);
 const representatives=[...members.values()].map(group=>[...group].sort((a,b)=>
  score(b)-score(a)||a.id.localeCompare(b.id))[0]!);
 return {representatives,members};
}
