import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {tvPublicEnabled} from "@/lib/tv-public-gate";
import {TvWorldSearch} from "@/components/tv/TvWorldSearch";
import {tvLocale} from "@/components/tv/tv-guide-model";
export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string}>};
export async function generateMetadata():Promise<Metadata>{
 return {title:"World TV search",robots:{index:false,follow:false}};
}
export default async function TvWorldSearchPage({params}:Props){
 const {locale}=await params;
 if(!tvPublicEnabled()||!hasLocale(routing.locales,locale))notFound();
 setRequestLocale(locale);
 return <TvWorldSearch locale={tvLocale(locale)}/>;
}
