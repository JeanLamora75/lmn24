"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {formatBroadcast,type TvLocale} from "./tv-guide-model";
import styles from "./tv-world-search.module.css";
import {useTvCountryNames} from "@/lib/tv-country-name-hook";
import {tvCountryName} from "@/lib/tv-country-names";

type Channel={id:string;countryIso2:string;number:number;name:string;logoUrl:string|null};
type Programme={id:string;variantId:string;countryIso2:string;channelId:string;channelName:string;
 number:number;logoUrl:string|null;imageUrl:string|null;category:string|null;
 title:string;startsAt:string;endsAt:string;timeZone:string};
type Section<T>={status:"OK"|"ERROR"|"SKIPPED";items:T[];hasNext:boolean;total?:number};
type Response={query:string;status:"OK"|"PARTIAL";channels:Section<Channel>;
 programmes:Section<Programme>};
type SectionName="channels"|"programmes";
const messages={
 fr:{title:"Recherche TV mondiale",intro:"Rechercher parmi tous les pays TV actifs.",
  search:"Chaîne, numéro ou émission",submit:"Rechercher",clear:"Effacer",
  channels:"Chaînes",programmes:"Programmes",more:"Voir plus",retry:"Réessayer",
  empty:"Aucun résultat.",prompt:"Saisissez un numéro de chaîne ou un titre.",
  loading:"Recherche en cours…",error:"Cette section est indisponible.",
  number:"N°",viewChannel:"Voir la chaîne",viewProgramme:"Voir la diffusion",onAir:"En cours"},
 en:{title:"Worldwide TV search",intro:"Search across all active TV countries.",
  search:"Channel, number or programme",submit:"Search",clear:"Clear",
  channels:"Channels",programmes:"Programmes",more:"Show more",retry:"Retry",
  empty:"No results.",prompt:"Enter a channel number or programme title.",
  loading:"Searching…",error:"This section is unavailable.",
  number:"No.",viewChannel:"View channel",viewProgramme:"View airing",onAir:"On now"},
} as const;
function parseSection<T>(input:unknown):input is Section<T>{
 if(!input||typeof input!=="object")return false;
 const v=input as Partial<Section<T>>;
 return (v.status==="OK"||v.status==="ERROR"||v.status==="SKIPPED")&&Array.isArray(v.items)
  &&typeof v.hasNext==="boolean";
}
function validResult(raw:unknown):raw is Response{
 if(!raw||typeof raw!=="object")return false;
 const v=raw as Partial<Response>;
 return typeof v.query==="string"&&parseSection<Channel>(v.channels)
  &&parseSection<Programme>(v.programmes);
}
function artwork(url:string|null):string|null{
 if(!url)return null;
 if(/^\/tv-icons\/[a-z0-9_.-]+$/i.test(url))return url;
 try{
  const u=new URL(url);
  return (u.protocol==="https:"||u.protocol==="http:")&&!u.username&&!u.password
   ?u.toString():null;
 }catch{return null;}
}
function minutesBetween(start:string,end:string):number{
 return Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/60_000));
}
function ProgrammeResult({row,locale,t,countryName,nowMs}:{
 row:Programme;locale:TvLocale;t:typeof messages.fr|typeof messages.en;
 countryName:(iso:string)=>string;nowMs:number|null;
}){
 const active=nowMs!==null&&Date.parse(row.startsAt)<=nowMs&&nowMs<Date.parse(row.endsAt);
 const progress=active?Math.max(0,Math.min(100,100*(nowMs!-Date.parse(row.startsAt))/
  (Date.parse(row.endsAt)-Date.parse(row.startsAt)))):0;
 const logo=artwork(row.logoUrl),image=artwork(row.imageUrl);
 const link=`/${locale}/tv/airings/${encodeURIComponent(row.id)}`;
 return <li className={`${styles.programmeCard} ${active?styles.programmeLive:""}`}>
  <div className={styles.programmeIdentity}>
   <div className={styles.programmeLogo}>
    {logo
     // eslint-disable-next-line @next/next/no-img-element
     ?<img src={logo} alt="" loading="lazy"/>
     :<span aria-hidden="true">TV</span>}
   </div>
   <span className={styles.programmeNumber}>{row.number>0?row.number:"—"}</span>
  </div>
  <div className={styles.programmeBody}>
   <div className={styles.programmeChannel}>{countryName(row.countryIso2)} · {row.channelName}</div>
   <div className={styles.programmeTime}>
    {formatBroadcast(row.startsAt,row.timeZone,locale)}
    {active&&<span className={styles.onAirBadge}>{t.onAir}</span>}
   </div>
   <Link className={styles.programmeTitle} href={link}
    aria-label={`${t.viewProgramme}: ${row.title}, ${countryName(row.countryIso2)}`}>{row.title}</Link>
   <div className={styles.programmeMeta}>
    {[row.category,minutesBetween(row.startsAt,row.endsAt)+" min"].filter(Boolean).join(" · ")}
    <span> · {new Intl.DateTimeFormat(locale,{timeZone:row.timeZone,day:"numeric",month:"short",year:"numeric"}).format(new Date(row.startsAt))}</span>
   </div>
   {active&&<div className={styles.programmeProgress} role="progressbar"
    aria-label={`${Math.round(progress)} %`} aria-valuenow={Math.round(progress)}
    aria-valuemin={0} aria-valuemax={100}>
    <span style={{width:progress+"%"}}/>
   </div>}
  </div>
  <div className={styles.programmePoster} aria-hidden="true">
   {image
    // eslint-disable-next-line @next/next/no-img-element
    ?<img src={image} alt="" loading="lazy"/>
    :<span className={styles.programmePosterPlaceholder}>▧</span>}
  </div>
 </li>;
}
export function TvWorldSearch({locale,initialQuery=""}:{locale:TvLocale;initialQuery?:string}){
 const t=locale==="fr"?messages.fr:messages.en;
 const countryNames=useTvCountryNames(locale);
 const [input,setInput]=useState(initialQuery);
 const [query,setQuery]=useState(initialQuery);
 const [data,setData]=useState<Response|null>(null);
 const [items,setItems]=useState<{channels:Channel[];programmes:Programme[]}>({channels:[],programmes:[]});
 const [pages,setPages]=useState({channels:1,programmes:1});
 const [loading,setLoading]=useState<SectionName|null>(null);
 const [errors,setErrors]=useState({channels:false,programmes:false});
 const [pending,setPending]=useState(0);
 const [nowMs,setNowMs]=useState<number|null>(null);
 useEffect(()=>{
  const update=()=>setNowMs(Date.now());
  update();
  const timer=setInterval(update,30_000);
  return ()=>clearInterval(timer);
 },[]);
 const requestId=useRef(0);
 const [requestedSection,setRequestedSection]=useState<"all"|SectionName>("all");
 const submit=(event:React.FormEvent)=>{
  event.preventDefault();
  const q=input.trim();
  requestId.current++;
  setRequestedSection("all");
  setQuery(q);setData(null);setItems({channels:[],programmes:[]});
  setPages({channels:1,programmes:1});setErrors({channels:false,programmes:false});
  setLoading(null);setPending(x=>x+1);
 };
 useEffect(()=>{
  if(!query)return;
  const controller=new AbortController();
  const id=++requestId.current;
  const params=new URLSearchParams({q:query,channelsPage:String(pages.channels),
   programmesPage:String(pages.programmes),pageSize:"30",section:requestedSection});
  fetch("/api/public/tv/search?"+params.toString(),{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    if(!response.ok)throw new Error("request");
    const value:unknown=await response.json();
    if(!validResult(value)||value.query!==query)throw new Error("response");
    return value;
   }).then(value=>{
    if(controller.signal.aborted||requestId.current!==id)return;
    setData(previous=>({
      ...value,
      channels:value.channels.status==="SKIPPED"?(previous?.channels??value.channels):value.channels,
      programmes:value.programmes.status==="SKIPPED"?(previous?.programmes??value.programmes):value.programmes,
    }));
    setItems(previous=>({
     channels:value.channels.status==="SKIPPED"?previous.channels:pages.channels===1?value.channels.items:
      [...previous.channels,...value.channels.items.filter(row=>
       !previous.channels.some(old=>old.id===row.id&&old.countryIso2===row.countryIso2))],
     programmes:value.programmes.status==="SKIPPED"?previous.programmes:pages.programmes===1?value.programmes.items:
      [...previous.programmes,...value.programmes.items.filter(row=>
       !previous.programmes.some(old=>old.id===row.id&&old.variantId===row.variantId))],
    }));
    setErrors(previous=>({
      channels:value.channels.status==="SKIPPED"?previous.channels:value.channels.status==="ERROR",
      programmes:value.programmes.status==="SKIPPED"?previous.programmes:value.programmes.status==="ERROR",
    }));
   }).catch(()=>{
    if(!controller.signal.aborted&&requestId.current===id){
     setErrors({channels:true,programmes:true});
    }
   }).finally(()=>{
    if(!controller.signal.aborted&&requestId.current===id)setLoading(null);
   });
  return ()=>controller.abort();
 },[query,pages,pending,requestedSection]);
 const loadMore=useCallback((part:SectionName)=>{
  setRequestedSection(part);
  setLoading(part);setPages(old=>({...old,[part]:old[part]+1}));
 },[]);
 const retry=useCallback((part:SectionName)=>{
  setRequestedSection(part);
  setLoading(part);setPending(v=>v+1);
 },[]);
 const countryName=(iso:string)=>tvCountryName(iso,locale,countryNames);
 const busy=query!==""&&!data&&!errors.channels&&!errors.programmes;
 return <main className={styles.page}>
  <h1>{t.title}</h1><p>{t.intro}</p>
  <form className={styles.form} onSubmit={submit}>
   <label htmlFor="tv-world-query">{t.search}</label>
   <div className={styles.controls}>
    <input id="tv-world-query" type="search" className="form-control" maxLength={120}
      value={input} onChange={e=>setInput(e.target.value)}/>
    <button type="submit" className="btn btn-primary">{t.submit}</button>
    <button type="button" className="btn btn-outline-secondary" onClick={()=>{
      requestId.current++;setInput("");setQuery("");setData(null);
      setItems({channels:[],programmes:[]});setErrors({channels:false,programmes:false});
    }}>{t.clear}</button>
   </div>
  </form>
  {!query&&<p role="status">{t.prompt}</p>}
  {busy&&<p role="status">{t.loading}</p>}
  {query&&(["channels","programmes"] as const).map(section=>{
   const sectionItems=items[section];
   const state=data?.[section];
   const hasError=errors[section];
   const canMore=state?.status==="OK"&&state.hasNext;
   return <section key={section} className={styles.section} aria-busy={loading===section}>
    <h2>{t[section]} {typeof state?.total==="number"&&<small>({state.total})</small>}</h2>
    {hasError&&<div role="alert">{t.error}
      <button className="btn btn-outline-primary ms-2" type="button"
       onClick={()=>retry(section)}>{t.retry}</button></div>}
    {!hasError&&state?.status==="OK"&&sectionItems.length===0&&<p>{t.empty}</p>}
    <ul className={section==="programmes"?styles.programmeList:styles.list}>
     {section==="channels"?(sectionItems as Channel[]).map(row=>
      <li key={row.countryIso2+":"+row.id} className={styles.result}>
       <div><strong>{countryName(row.countryIso2)} · {t.number} {row.number}</strong>
        <span>{row.name}</span></div>
       <Link href={`/${locale}/tv/channels/${encodeURIComponent(row.id)}?country=${row.countryIso2}`}
        aria-label={`${t.viewChannel}: ${row.name}, ${countryName(row.countryIso2)}, ${row.number}`}>{t.viewChannel}</Link>
      </li>):(sectionItems as Programme[]).map(row=>
       <ProgrammeResult key={row.id+":"+row.variantId} row={row} locale={locale}
        t={t} countryName={countryName} nowMs={nowMs}/>)}
    </ul>
    {canMore&&<button type="button" disabled={loading!==null}
     className="btn btn-outline-primary" onClick={()=>loadMore(section)}>{t.more}</button>}
   </section>;
  })}
 </main>;
}
