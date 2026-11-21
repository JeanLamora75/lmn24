"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {TV_COPY,type TvLocale} from "./tv-guide-model";
import {DETAIL_COPY,approvedExternalUrl,dayAtOffset,durationMinutes,gapItems,
  localDateLabel,offsetForDay,selectVariant,timeLabel,type TvChannelDetails as Channel,
  type TvChannelDay} from "./tv-detail-model";
import styles from "./tv-detail.module.css";

type Props={locale:TvLocale;initial:Channel;initialVariant:string|null;initialDate:string|null;};
function validDayPayload(value:unknown,channelId:string,variantId:string,localDate:string):value is TvChannelDay{
 if(!value||typeof value!=="object")return false;
 const v=value as Partial<TvChannelDay>;
 return v.channelId===channelId&&v.variantId===variantId&&v.localDate===localDate
  &&Array.isArray(v.airings)&&Array.isArray(v.gaps)
  &&!!v.pagination&&typeof v.pagination.hasNext==="boolean";
}
export function TvChannelDetails({locale,initial,initialVariant,initialDate}:Props){
 const copy=DETAIL_COPY[locale],common=TV_COPY[locale];
 const [variantId,setVariantId]=useState(()=>
  selectVariant(initial.variants,initialVariant,initial.defaultVariantId)?.id??null);
 const [dayOffset,setDayOffset]=useState(()=>{
  const selected=selectVariant(initial.variants,initialVariant,initial.defaultVariantId);
  return selected&&initialDate?offsetForDay(new Date(),selected.timeZone,initialDate)??0:0;
 });
 const [clockMode,setClockMode]=useState<"CHANNEL"|"VISITOR">("CHANNEL");
 const [day,setDay]=useState<TvChannelDay|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 const [page,setPage]=useState(1);
 const variant=useMemo(()=>initial.variants.find(v=>v.id===variantId)??null,
  [initial.variants,variantId]);
 const date=variant?dayAtOffset(new Date(),variant.timeZone,dayOffset):null;
 const displayZone=clockMode==="CHANNEL"?variant?.timeZone
  :Intl.DateTimeFormat().resolvedOptions().timeZone;
 const valid=!!day&&day.variantId===variant?.id&&day.localDate===date
  &&day.channelId===initial.channel.id;
 const changeVariant=useCallback((id:string)=>{
  const next=initial.variants.find(v=>v.id===id);
  if(!next)return;
  // Retain the day OFFSET, not a fabricated literal date in the old timezone.
  setVariantId(next.id);setDay(null);setError(false);setPage(1);setLoading(true);
 },[initial.variants]);
 const changeOffset=useCallback((step:-1|1)=>{
  setDayOffset(n=>Math.min(6,Math.max(0,n+step)));
  setDay(null);setError(false);setPage(1);setLoading(true);
 },[]);
 useEffect(()=>{
  if(!variant||!date){return;}
  const controller=new AbortController();
  const params=new URLSearchParams({country:initial.countryIso2,variantId:variant.id,
    localDate:date,page:String(page),pageSize:"100"});
  fetch(`/api/public/tv/channels/${initial.channel.id}/airings?${params}`,{
    cache:"no-store",signal:controller.signal,
  }).then(async result=>{
    if(!result.ok)throw new Error("Channel day unavailable");
    const payload:unknown=await result.json();
    if(!validDayPayload(payload,initial.channel.id,variant.id,date))
      throw new Error("Invalid channel day");
    return payload;
  }).then(data=>{
    if(controller.signal.aborted)return;
    setDay(prev=>page>1&&prev?.variantId===data.variantId&&prev.localDate===date
      ?{...data,airings:[...prev.airings,...data.airings]}:data);
    setError(false);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[initial.channel.id,initial.countryIso2,variant,date,page,retry]);

 const events=valid?gapItems(day.airings,day.gaps):[];
 const dayLabel=date?new Intl.DateTimeFormat(locale,{timeZone:"UTC",weekday:"long",
  day:"numeric",month:"long",year:"numeric"}).format(new Date(date+"T12:00:00Z")):"";
 const countryName=new Intl.DisplayNames([locale],{type:"region"}).of(initial.countryIso2)
  ??initial.countryIso2;
 const live=approvedExternalUrl(initial.officialLiveUrl);
 return <main className={`container py-4 py-lg-5 ${styles.page}`}>
  <Link href={`/${locale}/tv`} className={styles.back}>← {copy.back}</Link>
  <header className={styles.hero}>
   <div className={styles.logo}>{approvedExternalUrl(initial.channel.logoUrl)
      // eslint-disable-next-line @next/next/no-img-element
      ?<img src={approvedExternalUrl(initial.channel.logoUrl)!} alt="" loading="lazy"/>
      :<span>TV</span>}</div>
   <div className={styles.heroText}>
    <h1>{initial.channel.name}</h1>
    <p>{common.channelNumber} {initial.channel.number} · {copy.country}: {countryName}</p>
    {!!initial.channel.broadcastLanguages.length&&<p>{copy.language}: {initial.channel.broadcastLanguages.join(", ")}</p>}
   </div>
   {live&&<a href={live} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">{copy.live} ↗</a>}
  </header>
  <h2 className={styles.heading}>{copy.grid}</h2>
  <div className={styles.filters}>
   {initial.variants.length>1&&<label>{copy.variant}
     <select className="form-select" value={variantId??""} onChange={e=>changeVariant(e.target.value)}>
      {initial.variants.map(v=><option key={v.id} value={v.id}>{v.name} ({v.timeZone})</option>)}
     </select></label>}
   <label>{copy.clock}
    <select className="form-select" value={clockMode} onChange={e=>setClockMode(e.target.value as "CHANNEL"|"VISITOR")}>
     <option value="CHANNEL">{copy.channelClock}</option>
     <option value="VISITOR">{copy.visitorClock}</option>
    </select>
   </label>
  </div>
  <div className={styles.dayNav}>
   <button type="button" className="btn btn-outline-secondary" aria-label={copy.previous}
     disabled={dayOffset===0||!variant} onClick={()=>changeOffset(-1)}>‹</button>
   <strong aria-live="polite">{dayLabel}</strong>
   <button type="button" className="btn btn-outline-secondary" aria-label={copy.next}
     disabled={dayOffset===6||!variant} onClick={()=>changeOffset(1)}>›</button>
  </div>
  <section className={styles.timeline} aria-busy={loading} aria-label={copy.grid}>
   {loading&&<p role="status">{copy.loading}</p>}
   {error&&<div role="alert" className="alert alert-warning">{common.error}
     <button type="button" onClick={()=>{setRetry(n=>n+1);setLoading(true);}}
      className="btn btn-outline-primary ms-3">{copy.retry}</button></div>}
   {valid&&error&&<p className="text-body-secondary">{common.stale}</p>}
   {!variant&&!loading&&<p className="alert alert-secondary">{copy.empty}</p>}
   {valid&&!loading&&events.length===0&&<p className="alert alert-secondary">{copy.empty}</p>}
   {valid&&events.map((event)=>{
     const isAir=event.kind==="airing";
     const from=isAir?event.airing.startsAt:event.gap.startsAt;
     const until=isAir?event.airing.endsAt:event.gap.endsAt;
     const title=isAir?event.airing.title:copy.unavailable;
     const currentZone=displayZone??"UTC";
     const secondary=clockMode==="VISITOR"?localDateLabel(from,currentZone,locale):null;
     const content=<>
      <span className={styles.hour}>{timeLabel(from,currentZone,locale)}
       {secondary&&<small>{copy.dayOffset}: {secondary}</small>}</span>
      <span className={styles.eventBody}>
       <strong>{title}</strong>
       <small>{timeLabel(from,currentZone,locale)} – {timeLabel(until,currentZone,locale)}
        {isAir&&<> · {durationMinutes(from,until)} min{event.airing.category?` · ${event.airing.category}`:""}</>}</small>
      </span>
      <span aria-hidden="true" className={styles.chevron}>{isAir?"›":""}</span>
     </>;
     return isAir?<Link key={event.id} className={styles.event}
       href={`/${locale}/tv/airings/${encodeURIComponent(event.airing.id)}`}>{content}</Link>
      :<div key={event.id} className={`${styles.event} ${styles.gap}`}>{content}</div>;
   })}
   {valid&&day.pagination.hasNext&&!loading&&<button type="button"
     className="btn btn-outline-primary" onClick={()=>{setPage(n=>n+1);setLoading(true);}}>
     {common.next} · +100</button>}
  </section>
 </main>;
}
