import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {getBackendUrl} from "@/lib/admin-backend";
import {tvPublicEnabled} from "@/lib/tv-public-gate";
import {tvLocale,type TvLocale} from "@/components/tv/tv-guide-model";
import {DETAIL_COPY,approvedExternalUrl,durationMinutes,localDateLabel,
 timeLabel,validTvId,type TvAiringDetails} from "@/components/tv/tv-detail-model";
import styles from "@/components/tv/tv-detail.module.css";

export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string;airingId:string}>};
export async function generateMetadata():Promise<Metadata>{
 // An individual broadcast is always nonindexable, including after GO.
 return {robots:{index:false,follow:false}};
}
function verifiedDetail(value:unknown,id:string):value is TvAiringDetails{
 if(!value||typeof value!=="object")return false;
 const a=value as Partial<TvAiringDetails>;
 return a.id===id&&validTvId(a.variantId??"")&&validTvId(a.channel?.id??"")
  &&typeof a.startsAt==="string"&&Number.isFinite(Date.parse(a.startsAt))
  &&typeof a.endsAt==="string"&&Date.parse(a.endsAt)>Date.parse(a.startsAt)
  &&typeof a.variantTimeZone==="string"&&typeof a.title==="string"
  &&typeof a.countryIso2==="string"&&/^[A-Za-z]{2}$/.test(a.countryIso2);
}
function fallback(locale:TvLocale){return DETAIL_COPY[locale];}
export default async function TvAiringPage({params}:Props){
 const {locale,airingId}=await params;
 if(!tvPublicEnabled()||!hasLocale(routing.locales,locale)||!validTvId(airingId))notFound();
 setRequestLocale(locale);
 let airing:TvAiringDetails|null=null;
 let retired=false;
 try{
  const response=await fetch(getBackendUrl()+"/public/tv/airings/"+
    encodeURIComponent(airingId),{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(response.status===404)retired=true;
  else if(!response.ok)notFound();
  else {
   const data:unknown=await response.json();
   if(!verifiedDetail(data,airingId))notFound();
   airing=data;
  }
 }catch{notFound();}
 const copy=fallback(tvLocale(locale));
 if(retired)return <main className={`container py-5 ${styles.page}`}>
  <div role="status" className="alert alert-secondary">{copy.programmeGone}</div>
  <Link href={`/${locale}/tv`} className="btn btn-outline-primary">{copy.back}</Link>
 </main>;
 if(!airing)notFound();
 const localDate=new Intl.DateTimeFormat("en-CA",{
  timeZone:airing.variantTimeZone,year:"numeric",month:"2-digit",day:"2-digit",
 }).formatToParts(new Date(airing.startsAt));
 const get=(name:string)=>localDate.find(p=>p.type===name)?.value;
 const date=`${get("year")}-${get("month")}-${get("day")}`;
 const channelPath=`/${locale}/tv/channels/${encodeURIComponent(airing.channel.id)}`
  +`?country=${encodeURIComponent(airing.countryIso2)}`
  +`&variant=${encodeURIComponent(airing.variantId)}&date=${encodeURIComponent(date)}`;
 const image=approvedExternalUrl(airing.imageUrl);
 return <main className={`container py-4 py-lg-5 ${styles.page}`}>
  <Link href={channelPath} className={styles.back}>← {copy.seeGrid}</Link>
  <article className={styles.programmeHero}>
   <div className={styles.programmeImage}>
    {image
     // eslint-disable-next-line @next/next/no-img-element
     ?<img src={image} alt="" loading="lazy"/>
     :<span aria-hidden="true">▧</span>}
   </div>
   <div className={styles.programmeContent}>
    <h1>{airing.title}</h1>
    <p className={styles.meta}>{airing.channel.name} · {airing.channel.number} · {airing.countryIso2}</p>
    <p className={styles.meta}>
     {localDateLabel(airing.startsAt,airing.variantTimeZone,locale)}
     {" · "}{timeLabel(airing.startsAt,airing.variantTimeZone,locale)}
     {" – "}{timeLabel(airing.endsAt,airing.variantTimeZone,locale)}
    </p>
    <dl className={styles.details}>
     <div><dt>{copy.duration}</dt><dd>{durationMinutes(airing.startsAt,airing.endsAt)} min</dd></div>
     {airing.category&&<div><dt>{copy.category}</dt><dd>{airing.category}</dd></div>}
     {airing.season!==null&&<div><dt>{copy.season}</dt><dd>{airing.season}</dd></div>}
     {airing.episode!==null&&<div><dt>{copy.episode}</dt><dd>{airing.episode}</dd></div>}
    </dl>
    {airing.description&&<section>
     <h2 className="h5">{copy.description}</h2><p>{airing.description}</p>
    </section>}
    <Link href={channelPath} className="btn btn-outline-primary">{copy.seeGrid}</Link>
   </div>
  </article>
 </main>;
}
