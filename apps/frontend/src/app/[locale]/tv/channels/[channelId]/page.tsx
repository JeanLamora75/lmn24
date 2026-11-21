import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {getBackendUrl} from "@/lib/admin-backend";
import {tvPublicEnabled} from "@/lib/tv-public-gate";
import {tvLocale} from "@/components/tv/tv-guide-model";
import {validTvId,type TvChannelDetails as Channel} from "@/components/tv/tv-detail-model";
import {TvChannelDetails} from "@/components/tv/TvChannelDetails";

export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string;channelId:string}>;
 searchParams:Promise<{country?:string;variant?:string;date?:string}>};
export async function generateMetadata():Promise<Metadata>{
 return {robots:{index:false,follow:false}};
}
function validChannel(value:unknown,id:string,country:string):value is Channel{
 if(!value||typeof value!=="object")return false;
 const item=value as Partial<Channel>;
 return item.countryIso2?.toUpperCase()===country&&item.channel?.id===id
  &&Array.isArray(item.variants)&&item.variants.every(v=>v&&validTvId(v.id)
    &&typeof v.timeZone==="string");
}
export default async function TvChannelPage({params,searchParams}:Props){
 const [{locale,channelId},query]=await Promise.all([params,searchParams]);
 if(!tvPublicEnabled()||!hasLocale(routing.locales,locale)||!validTvId(channelId))notFound();
 const country=typeof query.country==="string"?query.country.toUpperCase():"";
 if(!/^[A-Z]{2}$/.test(country))notFound();
 setRequestLocale(locale);
 let initial:Channel;
 try{
  const url=getBackendUrl()+"/public/tv/channels/"+encodeURIComponent(channelId)
    +"?country="+encodeURIComponent(country)+"&locale="+encodeURIComponent(locale);
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)notFound();
  const body:unknown=await response.json();
  if(!validChannel(body,channelId,country))notFound();
  initial=body;
 }catch{notFound();}
 const variant=typeof query.variant==="string"&&validTvId(query.variant)?query.variant:null;
 const date=typeof query.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(query.date)
  ?query.date:null;
 return <TvChannelDetails locale={tvLocale(locale)} initial={initial}
  initialVariant={variant} initialDate={date}/>;
}
