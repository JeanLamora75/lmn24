"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import type {TvLocale} from "./tv-guide-model";
import styles from "./tv-world-search.module.css";

type Channel={id:string;countryIso2:string;number:number;name:string;logoUrl:string|null};
type Programme={id:string;variantId:string;countryIso2:string;channelId:string;channelName:string;
 number:number;title:string;startsAt:string;endsAt:string;timeZone:string};
type Section<T>={status:"OK"|"ERROR";items:T[];hasNext:boolean;total?:number};
type Response={query:string;status:"OK"|"PARTIAL";channels:Section<Channel>;
 programmes:Section<Programme>};
type SectionName="channels"|"programmes";
const messages={
 fr:{title:"Recherche TV mondiale",intro:"Rechercher parmi tous les pays TV actifs.",
  search:"Chaîne, numéro ou émission",submit:"Rechercher",clear:"Effacer",
  channels:"Chaînes",programmes:"Programmes",more:"Voir plus",retry:"Réessayer",
  empty:"Aucun résultat.",prompt:"Saisissez un numéro de chaîne ou un titre.",
  loading:"Recherche en cours…",error:"Cette section est indisponible.",
  number:"N°",viewChannel:"Voir la chaîne",viewProgramme:"Voir la diffusion"},
 en:{title:"Worldwide TV search",intro:"Search across all active TV countries.",
  search:"Channel, number or programme",submit:"Search",clear:"Clear",
  channels:"Channels",programmes:"Programmes",more:"Show more",retry:"Retry",
  empty:"No results.",prompt:"Enter a channel number or programme title.",
  loading:"Searching…",error:"This section is unavailable.",
  number:"No.",viewChannel:"View channel",viewProgramme:"View airing"},
} as const;
function parseSection<T>(input:unknown):input is Section<T>{
 if(!input||typeof input!=="object")return false;
 const v=input as Partial<Section<T>>;
 return (v.status==="OK"||v.status==="ERROR")&&Array.isArray(v.items)
  &&typeof v.hasNext==="boolean";
}
function validResult(raw:unknown):raw is Response{
 if(!raw||typeof raw!=="object")return false;
 const v=raw as Partial<Response>;
 return typeof v.query==="string"&&parseSection<Channel>(v.channels)
  &&parseSection<Programme>(v.programmes);
}
export function TvWorldSearch({locale}:{locale:TvLocale}){
 const t=locale==="fr"?messages.fr:messages.en;
 const [input,setInput]=useState("");
 const [query,setQuery]=useState("");
 const [data,setData]=useState<Response|null>(null);
 const [items,setItems]=useState<{channels:Channel[];programmes:Programme[]}>({channels:[],programmes:[]});
 const [pages,setPages]=useState({channels:1,programmes:1});
 const [loading,setLoading]=useState<SectionName|null>(null);
 const [errors,setErrors]=useState({channels:false,programmes:false});
 const [pending,setPending]=useState(0);
 const requestId=useRef(0);
 const submit=(event:React.FormEvent)=>{
  event.preventDefault();
  const q=input.trim();
  requestId.current++;
  setQuery(q);setData(null);setItems({channels:[],programmes:[]});
  setPages({channels:1,programmes:1});setErrors({channels:false,programmes:false});
  setLoading(null);setPending(x=>x+1);
 };
 useEffect(()=>{
  if(!query)return;
  const controller=new AbortController();
  const id=++requestId.current;
  const params=new URLSearchParams({q:query,channelsPage:String(pages.channels),
   programmesPage:String(pages.programmes),pageSize:"30"});
  fetch("/api/public/tv/search?"+params.toString(),{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    if(!response.ok)throw new Error("request");
    const value:unknown=await response.json();
    if(!validResult(value)||value.query!==query)throw new Error("response");
    return value;
   }).then(value=>{
    if(controller.signal.aborted||requestId.current!==id)return;
    setData(value);
    setItems(previous=>({
     channels:pages.channels===1?value.channels.items:
      [...previous.channels,...value.channels.items.filter(row=>
       !previous.channels.some(old=>old.id===row.id&&old.countryIso2===row.countryIso2))],
     programmes:pages.programmes===1?value.programmes.items:
      [...previous.programmes,...value.programmes.items.filter(row=>
       !previous.programmes.some(old=>old.id===row.id&&old.variantId===row.variantId))],
    }));
    setErrors({channels:value.channels.status==="ERROR",programmes:value.programmes.status==="ERROR"});
   }).catch(()=>{
    if(!controller.signal.aborted&&requestId.current===id){
     setErrors({channels:true,programmes:true});
    }
   }).finally(()=>{
    if(!controller.signal.aborted&&requestId.current===id)setLoading(null);
   });
  return ()=>controller.abort();
 },[query,pages,pending]);
 const loadMore=useCallback((part:SectionName)=>{
  setLoading(part);setPages(old=>({...old,[part]:old[part]+1}));
 },[]);
 const retry=useCallback((part:SectionName)=>{
  setLoading(part);setPending(v=>v+1);
 },[]);
 const countryName=(iso:string)=>new Intl.DisplayNames([locale],{type:"region"}).of(iso)??iso;
 const dateLabel=(iso:string,zone:string)=>new Intl.DateTimeFormat(locale,{
  timeZone:zone,year:"numeric",month:"short",day:"numeric",
  hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
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
    <ul className={styles.list}>
     {section==="channels"?(sectionItems as Channel[]).map(row=>
      <li key={row.countryIso2+":"+row.id} className={styles.result}>
       <div><strong>{countryName(row.countryIso2)} · {t.number} {row.number}</strong>
        <span>{row.name}</span></div>
       <Link href={`/${locale}/tv/channels/${encodeURIComponent(row.id)}?country=${row.countryIso2}`}
        aria-label={`${t.viewChannel}: ${row.name}, ${countryName(row.countryIso2)}, ${row.number}`}>{t.viewChannel}</Link>
      </li>):(sectionItems as Programme[]).map(row=>
       <li key={row.id+":"+row.variantId} className={styles.result}>
        <div><strong>{countryName(row.countryIso2)} · {t.number} {row.number} · {row.channelName}</strong>
         <span>{row.title}</span>
         <small>{dateLabel(row.startsAt,row.timeZone)} · {row.timeZone}</small></div>
        <Link href={`/${locale}/tv/airings/${encodeURIComponent(row.id)}`}
         aria-label={`${t.viewProgramme}: ${row.title}, ${countryName(row.countryIso2)}`}>{t.viewProgramme}</Link>
       </li>)}
    </ul>
    {canMore&&<button type="button" disabled={loading!==null}
     className="btn btn-outline-primary" onClick={()=>loadMore(section)}>{t.more}</button>}
   </section>;
  })}
 </main>;
}
