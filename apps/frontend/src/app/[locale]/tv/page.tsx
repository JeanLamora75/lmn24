import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {tvPublicEnabled} from "@/lib/tv-public-gate";
import {TV_COPY,tvLocale} from "@/components/tv/tv-guide-model";
import {TvGuideHome} from "@/components/tv/TvGuideHome";

export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale}=await params;
 if(!tvPublicEnabled()||!hasLocale(routing.locales,locale))
  return {robots:{index:false,follow:false}};
 const copy=TV_COPY[tvLocale(locale)];
 return {title:copy.title,description:copy.subtitle,
  robots:{index:false,follow:false}};
}
export default async function TvHomePage({params}:Props){
 const {locale}=await params;
 // Defense-in-depth: middleware and server component MUST both deny.
 if(!tvPublicEnabled()||!hasLocale(routing.locales,locale))notFound();
 setRequestLocale(locale);
 return <TvGuideHome locale={tvLocale(locale)}/>;
}
