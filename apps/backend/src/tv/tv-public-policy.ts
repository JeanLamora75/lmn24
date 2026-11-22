import { localDayBounds, assertLocalDate } from "./tv-import-time";

export const TV_LANGUAGES = ["fr","en","de","es","pt","it","ru","nl"] as const;
export type TvPublicTab = "CHANNELS" | "NOW" | "TONIGHT" | "LATE";
export type ProgrammeState = "AVAILABLE" | "EPG_UNAVAILABLE" | "NO_START_IN_WINDOW";
export type TvAiring = {
  id:string;variantId:string;sourceId:string;startsAt:string;endsAt:string;
  title:string;category:string|null;description:string|null;imageUrl:string|null;
};
export type CoverageEvidence = {
  variantId:string;sourceId:string;startMs:number;endMs:number;
  verified:boolean;approvedAt:string|null;
};
export type TvWindow = {startMs:number;endMs:number;tab:TvPublicTab};

/** The reference calendar is the selected country on the home screen, and
 * the selected variant on channel detail. Visitor time changes display ONLY.
 */
export function todayInZone(now:Date,zone:string):string {
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(now);
  const val=(key:string)=>parts.find(p=>p.type===key)?.value;
  return `${val("year")}-${val("month")}-${val("day")}`;
}
export function addLocalDays(localDate:string,days:number):string {
  assertLocalDate(localDate);
  if(!Number.isInteger(days)||days<0||days>6)throw new RangeError("Day offset must be 0..6");
  return new Date(Date.parse(localDate+"T00:00:00Z")+days*86_400_000)
    .toISOString().slice(0,10);
}
export function assertTvDay(localDate:string,timezone:string,now:Date):string {
  assertLocalDate(localDate);
  const start=todayInZone(now,timezone);
  if(!Array.from({length:7},(_,day)=>addLocalDays(start,day)).includes(localDate))
    throw new RangeError("TV_DATE_OUTSIDE_J0_J6");
  return localDate;
}
export function localClock(epochMs:number,timezone:string):{day:string;hour:number;minute:number;second:number}{
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",
  }).formatToParts(new Date(epochMs));
  const get=(name:string)=>parts.find(part=>part.type===name)?.value??"0";
  return {day:`${get("year")}-${get("month")}-${get("day")}`,
    hour:Number(get("hour")),minute:Number(get("minute")),second:Number(get("second"))};
}
export function isWithinStartWindow(
  startIso:string,timezone:string,localDate:string,tab:TvPublicTab,
):boolean {
  const start=Date.parse(startIso);
  if(!Number.isFinite(start))return false;
  const local=localClock(start,timezone);
  if(local.day!==localDate)return false;
  const ms=new Date(start).getUTCMilliseconds();
  const clock=((local.hour*60+local.minute)*60+local.second)*1000+ms;
  if(tab==="TONIGHT")return clock>=((20*60+30)*60)*1000
    &&clock<=((21*60+30)*60)*1000;
  if(tab==="LATE")return clock>=((22*60+30)*60)*1000
    &&clock<=((23*60+30)*60)*1000;
  return true;
}
export function tvWindow(
  tab:TvPublicTab,localDate:string,zone:string,now:Date,
):TvWindow {
  const bounds=localDayBounds(localDate,zone);
  if(tab==="NOW")return {tab,startMs:now.getTime(),endMs:now.getTime()+1};
  if(tab==="CHANNELS")return {tab,startMs:bounds.startMs,endMs:bounds.endMs};
  // During DST, a local clock window may have >1 UTC interval. Coverage
  // checks must not infer completeness from this envelope alone.
  const begin=tab==="TONIGHT"?20*60+30:22*60+30;
  const finish=tab==="TONIGHT"?21*60+30:23*60+30;
  const first:number[]=[];
  for(let epoch=bounds.startMs;epoch<bounds.endMs;epoch+=60_000){
    const clock=localClock(epoch,zone),min=clock.hour*60+clock.minute;
    if(clock.day===localDate && min>=begin && min<=finish)first.push(epoch);
  }
  if(!first.length)throw new RangeError("Local programme window does not exist");
  return {tab,startMs:first[0]!,endMs:first[first.length-1]!+60_000};
}
export function coversWindow(
  evidence:readonly CoverageEvidence[],variantId:string,
  startMs:number,endMs:number,now:Date,
):boolean {
  if(!(startMs<endMs))return false;
  // Verified source-attested, licensed ranges only; no invented coverage.
  const fresh=evidence.filter(c=>c.verified&&c.variantId===variantId
    &&!!c.sourceId && !!c.approvedAt && Number.isFinite(Date.parse(c.approvedAt))
    &&Date.parse(c.approvedAt)<=now.getTime()
    &&c.startMs<endMs && c.endMs>startMs)
    .map(c=>({from:Math.max(startMs,c.startMs),to:Math.min(endMs,c.endMs)}))
    .sort((a,b)=>a.from-b.from);
  let covered=startMs;
  for(const span of fresh){if(span.from>covered)return false;covered=Math.max(covered,span.to);}
  return covered>=endMs;
}
export function stateForChannel(args:{
  tab:TvPublicTab;localDate:string;timezone:string;variantId:string|null;
  airings:readonly TvAiring[];coverage:readonly CoverageEvidence[];
  now:Date;
}):{programmeState:ProgrammeState;airing:TvAiring|null}{
  const {tab,localDate,timezone,variantId,now}=args;
  if(!variantId)return {programmeState:"EPG_UNAVAILABLE",airing:null};
  const bounds=localDayBounds(localDate,timezone);
  const matching=args.airings.filter(a=>{
    if(a.variantId!==variantId)return false;
    const from=Date.parse(a.startsAt),until=Date.parse(a.endsAt);
    if(!Number.isFinite(from)||!Number.isFinite(until)||until<=from)return false;
    if(tab==="NOW")return from<=now.getTime()&&now.getTime()<until;
    if(tab==="CHANNELS")return from<bounds.endMs&&until>bounds.startMs;
    const window=tvWindow(tab,localDate,timezone,now);
    return from<window.endMs&&until>window.startMs;
  }).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
  if(matching[0])return {programmeState:"AVAILABLE",airing:matching[0]};
  // No independent evidence => NEVER say the window is completely empty.
  if(tab!=="NOW"&&tab!=="CHANNELS"&&coversWindow(args.coverage,variantId,
    tvWindow(tab,localDate,timezone,now).startMs,
    tvWindow(tab,localDate,timezone,now).endMs,now)){
    return {programmeState:"NO_START_IN_WINDOW",airing:null};
  }
  return {programmeState:"EPG_UNAVAILABLE",airing:null};
}
export function gapsInDay(
  airings:readonly TvAiring[],localDate:string,zone:string,
):{startsAt:string;endsAt:string;reason:"EPG_UNAVAILABLE"}[]{
  const {startMs,endMs}=localDayBounds(localDate,zone);
  const spans=airings.map(a=>({from:Math.max(startMs,Date.parse(a.startsAt)),
    to:Math.min(endMs,Date.parse(a.endsAt))}))
    .filter(s=>s.from<s.to).sort((a,b)=>a.from-b.from);
  const gaps:{startsAt:string;endsAt:string;reason:"EPG_UNAVAILABLE"}[]=[];
  let cursor=startMs;
  for(const span of spans){
    if(span.from>cursor)gaps.push({startsAt:new Date(cursor).toISOString(),
      endsAt:new Date(span.from).toISOString(),reason:"EPG_UNAVAILABLE"});
    cursor=Math.max(cursor,span.to);
  }
  if(cursor<endMs)gaps.push({startsAt:new Date(cursor).toISOString(),
    endsAt:new Date(endMs).toISOString(),reason:"EPG_UNAVAILABLE"});
  return gaps;
}
