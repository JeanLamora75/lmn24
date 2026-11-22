"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useVisitorPreferences} from "@/components/public/VisitorPreferencesProvider";
import {
 TV_COPY,TV_TABS,dateOffset,filterBroadcastLanguage,formatBroadcast,
 localToday,moveDate,resolveCountry,type TvCountry,type TvLocale,
 type TvSchedule,type TvScheduleItem,type TvTab,
} from "./tv-guide-model";
import styles from "./tv-guide.module.css";
import {useTvCountryNames} from "@/lib/tv-country-name-hook";
import {tvCountryName} from "@/lib/tv-country-names";

type CountryResponse={items:TvCountry[]};
type ClockMode="CHANNEL"|"VISITOR";
const languageOptions=["all","fr","en","de","es","pt","it","ru","nl"];
function isCountryResponse(input:unknown):input is CountryResponse{
 if(!input||typeof input!=="object"||!("items" in input))return false;
 const items=(input as {items:unknown}).items;
 return Array.isArray(items)&&items.every(x=>x&&typeof x==="object"
   &&typeof x.countryIso2==="string"&&typeof x.referenceTimeZone==="string"
   &&typeof x.label==="string");
}
function isSchedule(input:unknown):input is TvSchedule{
 if(!input||typeof input!=="object")return false;
 const data=input as Partial<TvSchedule>;
 return Array.isArray(data.items)&&typeof data.countryIso2==="string"
  &&typeof data.localDate==="string"&&!!data.pagination
  &&typeof data.pagination.hasNext==="boolean";
}
function safeProgrammeImage(url:string|null):string|null{
 if(!url)return null;
 if(/^\/tv-icons\/[a-z0-9_.-]+$/i.test(url))return url;
 try{const parsed=new URL(url);return (parsed.protocol==="https:"||parsed.protocol==="http:")&&!parsed.username&&!parsed.password?parsed.toString():null;}
 catch{return null;}
}
function duration(start:string,end:string):string{
 const minutes=Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/60000));
 return Number.isFinite(minutes)?minutes+" min":"";
}
/** The Channels tab is a channel picker, not a miniature programme grid. */
function TvChannelLogo({item,locale,countryIso2,date}:{
 item:TvScheduleItem;locale:TvLocale;countryIso2:string;date:string;
}){
 const href=`/${locale}/tv/channels/${encodeURIComponent(item.channel.id)}?country=${encodeURIComponent(countryIso2)}&date=${encodeURIComponent(date)}`;
 const logo=safeProgrammeImage(item.channel.logoUrl);
 return <Link href={href} className={styles.logoTile}
   aria-label={item.channel.name+" — "+(locale==="fr"?"voir les programmes du ":"view schedule for ")+date}
   title={item.channel.name}>
   <span className={styles.logoTileArt}>
    {logo
      // eslint-disable-next-line @next/next/no-img-element
      ?<img src={logo} alt={item.channel.name} loading="lazy"/>
      :<span className={styles.logoTileFallback} aria-hidden="true">TV</span>}
   </span>
   <span className={styles.logoTileCaption}>
    {item.channel.number>0?`${item.channel.number} - ${item.channel.name}`:item.channel.name}
   </span>
 </Link>;
}

function TvCard({item,locale,mode,tab,countryIso2,nowMs,preview=false}:{
 item:TvScheduleItem;locale:TvLocale;mode:ClockMode;tab:TvTab;
 countryIso2:string;nowMs:number|null;preview?:boolean;
}){
 const copy=TV_COPY[locale],a=item.airing,zone=mode==="VISITOR"
  ?Intl.DateTimeFormat().resolvedOptions().timeZone
  :item.variant?.timeZone??"UTC";
 const image=safeProgrammeImage(a?.imageUrl??null);
 const channelHref=`/${locale}/tv/channels/${encodeURIComponent(item.channel.id)}?country=${countryIso2}`;
 const programmeHref=a&&item.variant?
  `/${locale}/tv/airings/${encodeURIComponent(a.id)}`:null;
 const live=tab==="NOW"&&a&&nowMs!==null&&Date.parse(a.startsAt)<=nowMs&&nowMs<Date.parse(a.endsAt);
 const progress=live&&a?Math.max(0,Math.min(100,
  100*((nowMs??0)-Date.parse(a.startsAt))/(Date.parse(a.endsAt)-Date.parse(a.startsAt)))):null;
 return <article className={styles.card} aria-label={`${copy.channelNumber} ${item.channel.number}: ${item.channel.name}`}>
  <div className={styles.identity}>
   <div className={styles.logoBox}>
    {safeProgrammeImage(item.channel.logoUrl)
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={safeProgrammeImage(item.channel.logoUrl)!} alt="" loading="lazy"/>
      : <span aria-hidden="true">TV</span>}
   </div>
   <span className={styles.channelNumber} aria-label={`${copy.channelNumber} ${item.channel.number}`}>{item.channel.number}</span>
  </div>
  <div className={styles.cardBody}>
   <div className={styles.channelName}>{preview?item.channel.name:<Link href={channelHref}>{item.channel.name}</Link>}</div>
   {a&&item.programmeState==="AVAILABLE"
    ?<>
      <span className={styles.time}>{formatBroadcast(a.startsAt,zone,locale)}</span>
      <h2 className={styles.programmeTitle}>
       {programmeHref&&!preview?<Link href={programmeHref}>{a.title}</Link>:a.title}
      </h2>
      <div className={styles.metadata}>{[a.category,duration(a.startsAt,a.endsAt)].filter(Boolean).join(" · ")}</div>
      {progress!==null&&<div className={styles.progress} role="progressbar"
        aria-label={`${Math.round(progress)}%`} aria-valuenow={Math.round(progress)}
        aria-valuemin={0} aria-valuemax={100}>
        <span style={{width:progress+"%"}}/>
      </div>}
     </>
    :<p className={styles.missing}>{item.programmeState==="NO_START_IN_WINDOW"?copy.noStart:copy.missing}</p>}
  </div>
  <div className={styles.poster} aria-hidden="true">
   {image
    // eslint-disable-next-line @next/next/no-img-element
    ?<img src={image} alt="" loading="lazy"/>
    :<div className={styles.posterFallback}><span>▧</span></div>}
  </div>
 </article>;
}

export function TvGuideHome({locale,preview=false}: {locale:TvLocale;preview?:boolean}){
 const copy=TV_COPY[locale];
 const countryNames=useTvCountryNames(locale);
 const router=useRouter();
 const {preferences,ready}=useVisitorPreferences();
 const [countries,setCountries]=useState<TvCountry[]>([]);
 const [countryIso2,setCountryIso2]=useState<string|null>(null);
 const [loadingCountries,setLoadingCountries]=useState(true);
 const [countryError,setCountryError]=useState(false);
 const [language,setLanguage]=useState("all");
 const [clockMode,setClockMode]=useState<ClockMode>("CHANNEL");
 const [dayIndex,setDayIndex]=useState(0);
 const [tab,setTab]=useState<TvTab>("TONIGHT");
 const [notice,setNotice]=useState("");
 const [schedule,setSchedule]=useState<TvSchedule|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 const [page,setPage]=useState(1);
 const [search,setSearch]=useState("");
 const [nowMs,setNowMs]=useState<number|null>(null);
 useEffect(()=>{
  const tick=()=>setNowMs(Date.now());
  const first=setTimeout(tick,0);
  const timer=setInterval(tick,30_000);
  return ()=>{clearTimeout(first);clearInterval(timer);};
 },[]);
 const selectedCountry=useMemo(()=>countries.find(c=>c.countryIso2===countryIso2)??null,
  [countries,countryIso2]);
 const today=selectedCountry?localToday(new Date(),selectedCountry.referenceTimeZone):null;
 const date=today?dateOffset(today,dayIndex):null;

 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  fetch(preview?"/api/admin/tv/catalog/countries":"/api/public/tv/countries?locale="+locale,{signal:controller.signal,cache:"no-store"})
   .then(async response=>{
     if(!response.ok)throw new Error("TV countries unavailable");
     const parsed:unknown=await response.json();
     if(preview){
      const raw=parsed as {items?:Array<{isoCode2:string;referenceTimezone:string;isActive:boolean}>};
      if(!Array.isArray(raw.items))throw new Error("Bad admin countries response");
      return raw.items.filter(c=>c.isActive).map(c=>({
       countryIso2:c.isoCode2,referenceTimeZone:c.referenceTimezone,label:c.isoCode2,
      }));
     }
     if(!isCountryResponse(parsed))throw new Error("Bad country response");
     return parsed.items;
   }).then(items=>{
     setCountries(items);
     setCountryIso2(resolveCountry(items,preferences.countryIso2,locale)?.countryIso2??null);
     setCountryError(false);
     setLoading(true);
   }).catch(()=>{
     if(!controller.signal.aborted)setCountryError(true);
   }).finally(()=>{if(!controller.signal.aborted)setLoadingCountries(false);});
  return ()=>controller.abort();
 },[ready,preferences.countryIso2,locale,retry,preview]);

 useEffect(()=>{
  if(!selectedCountry||!date)return;
  const controller=new AbortController();
  const params=new URLSearchParams({country:selectedCountry.countryIso2,localDate:date,
    tab,page:String(page),pageSize:"100"});
  fetch((preview?"/api/admin/tv/catalog/preview/schedule":"/api/public/tv/schedule")+"?"+params.toString(),{cache:"no-store",signal:controller.signal})
   .then(async response=>{
     if(!response.ok)throw new Error("TV schedule unavailable");
     const raw:unknown=await response.json();
     if(!isSchedule(raw))throw new Error("Bad schedule");
     return raw;
   }).then(data=>{
     if(controller.signal.aborted)return;
     if(data.countryIso2!==selectedCountry.countryIso2||data.localDate!==date||data.tab!==tab)
       throw new Error("TV schedule scope mismatch");
     setSchedule(prev=>page>1&&prev?.countryIso2===data.countryIso2
       &&prev.localDate===data.localDate&&prev.tab===tab
       ?{...data,items:[...prev.items,...data.items]}:data);
     setError(false);
   }).catch(()=>{if(!controller.signal.aborted)setError(true);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[selectedCountry,date,tab,page,retry,preview]);

 const changeCountry=useCallback((iso:string)=>{
  setCountryIso2(iso);setSchedule(null);setPage(1);setDayIndex(0);setError(false);
  setLoading(true);
 },[]);
 const changeTab=useCallback((next:TvTab)=>{
  if(next==="NOW"&&dayIndex>0)return;
  setTab(next);setSchedule(null);setPage(1);setError(false);setLoading(true);
 },[dayIndex]);
 const changeDate=useCallback((step:-1|1)=>{
  const result=moveDate(dayIndex,tab,step);
  if(result.dayIndex===dayIndex)return;
  setDayIndex(result.dayIndex);setTab(result.tab);setPage(1);
  setSchedule(null);setLoading(true);setNotice(result.notice?copy.changeNow:"");
 },[dayIndex,tab,copy.changeNow]);
 const visible=useMemo(()=>filterBroadcastLanguage(schedule?.items??[],language),
  [schedule,language]);
 const labels=new Intl.DisplayNames([locale],{type:"language"});
 const dateLabel=date?new Intl.DateTimeFormat(locale,{
   timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric",
  }).format(new Date(date+"T12:00:00Z")):"";
 const validScope=!!schedule&&schedule.countryIso2===countryIso2
   &&schedule.localDate===date&&schedule.tab===tab;
 return <main className={`container py-4 py-lg-5 ${styles.page}`}>
  {preview&&<div role="status" className="alert alert-warning">Aperçu privé réservé à l’administration — données non publiées. La grille publique reste désactivée.</div>}
  <header className={styles.header}>
   <h1>{copy.title}</h1><p>{copy.subtitle}</p>
  </header>
  {!preview&&<div className={styles.searchLine}>
   <form onSubmit={event=>{event.preventDefault();if(search.trim())router.push(`/${locale}/tv/search?q=${encodeURIComponent(search.trim())}`);}}>
    <label className="visually-hidden" htmlFor="tv-global-search">{copy.search}</label>
    <input id="tv-global-search" className="form-control" type="search" value={search}
      onChange={event=>setSearch(event.target.value)} placeholder={copy.search} maxLength={120}/>
    <button type="submit" className="btn btn-outline-primary" aria-label={copy.search}>⌕</button>
   </form>
  </div>}
  <div className={styles.filters}>
   <label>{copy.country}
    <select className="form-select" disabled={loadingCountries||!countries.length}
      value={countryIso2??""} onChange={e=>changeCountry(e.target.value)}>
     {countries.length===0&&<option value="">—</option>}
     {countries.map(c=><option key={c.countryIso2} value={c.countryIso2}>{tvCountryName(c.countryIso2,locale,countryNames)}</option>)}
    </select>
   </label>
   <label>{copy.language}
    <select className="form-select" value={language} onChange={e=>setLanguage(e.target.value)}>
     {languageOptions.map(code=><option key={code} value={code}>
       {code==="all"?copy.allLanguages:labels.of(code)??code}
     </option>)}
    </select>
   </label>
   <label>{copy.clock}
    <select className="form-select" value={clockMode}
      onChange={e=>setClockMode(e.target.value as ClockMode)}>
     <option value="CHANNEL">{copy.channelClock}</option>
     <option value="VISITOR">{copy.visitorClock}</option>
    </select>
   </label>
  </div>
  <div className={styles.dateNav} aria-label={dateLabel}>
   <button type="button" aria-label={copy.previous} disabled={dayIndex===0||!date}
     onClick={()=>changeDate(-1)} className="btn btn-outline-secondary">‹</button>
   <strong aria-live="polite">{dateLabel}</strong>
   <button type="button" aria-label={copy.next} disabled={dayIndex===6||!date}
     onClick={()=>changeDate(1)} className="btn btn-outline-secondary">›</button>
  </div>
  <div className={styles.tabs} role="tablist" aria-label={copy.title}>
   {TV_TABS.map((value,i)=><button key={value} role="tab" id={`tv-tab-${value}`}
     type="button" aria-selected={tab===value} aria-controls="tv-tab-content"
     tabIndex={tab===value?0:-1}
     disabled={value==="NOW"&&dayIndex!==0} onClick={()=>changeTab(value)}
     onKeyDown={event=>{
       const enabled=TV_TABS.filter(candidate=>candidate!=="NOW"||dayIndex===0);
       const position=enabled.indexOf(value);
       let next:TvTab|undefined;
       if(event.key==="ArrowRight")next=enabled[(position+1)%enabled.length];
       if(event.key==="ArrowLeft")next=enabled[(position+enabled.length-1)%enabled.length];
       if(event.key==="Home")next=enabled[0];
       if(event.key==="End")next=enabled[enabled.length-1];
       if(!next)return;
       event.preventDefault();
       changeTab(next);
       document.getElementById("tv-tab-"+next)?.focus();
     }}
     className={tab===value?styles.activeTab:""}>{copy.tabs[i]}</button>)}
  </div>
  <div role="status" aria-live="polite" className={styles.notice}>{notice}</div>
  <section id="tv-tab-content" role="tabpanel" aria-labelledby={`tv-tab-${tab}`}
    aria-busy={loading||loadingCountries} className={styles.results}>
   {(loadingCountries||loading)&&<p role="status" className={styles.feedback}>{copy.loading}</p>}
   {countryError&&<div role="alert" className={styles.feedback}>{copy.error}
     <button type="button" className="btn btn-outline-primary ms-3"
       onClick={()=>{setLoadingCountries(true);setRetry(v=>v+1);}}>{copy.retry}</button></div>}
   {error&&<div role="alert" className={styles.feedback}>
     {copy.error}{validScope&&<span> {copy.stale}</span>}
     <button type="button" className="btn btn-outline-primary ms-3"
       onClick={()=>{setLoading(true);setRetry(v=>v+1);}}>{copy.retry}</button>
   </div>}
   {!loading&&!loadingCountries&&!countryError&&countries.length===0&&
     <p className={styles.feedback}>{copy.empty}</p>}
   {validScope&&visible.length>0&&
    (tab==="CHANNELS"
     ?<div className={styles.logoGrid} aria-label={copy.tabs[0]}>
       {visible.map((item,i)=><TvChannelLogo key={item.channel.id+":"+i}
         item={item} locale={locale} countryIso2={countryIso2??""} date={date!}/>)}
      </div>
     :<div className={styles.grid}>
       {visible.map((item,i)=><TvCard key={item.channel.id+":"+i} item={item}
         locale={locale} mode={clockMode} tab={tab} countryIso2={countryIso2??""} nowMs={nowMs} preview={preview}
         />)}
      </div>)}
   {validScope&&!loading&&!error&&schedule.items.length===0&&
      <p className={styles.feedback}>{copy.empty}</p>}
   {validScope&&!loading&&!error&&schedule.items.length>0&&visible.length===0&&
      <div className={styles.feedback}>{copy.noLanguage}
       <button type="button" className="btn btn-outline-primary ms-3"
         onClick={()=>setLanguage("all")}>{copy.resetLanguage}</button>
      </div>}
   {validScope&&schedule.pagination.hasNext&&!loading&&
     <button type="button" className="btn btn-outline-primary d-block mx-auto mt-4"
       onClick={()=>{setPage(v=>v+1);setLoading(true);}}>{copy.next} · +100</button>}
  </section>
 </main>;
}
