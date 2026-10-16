import type {Metadata} from "next";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {PublicWeather} from "@/components/weather/PublicWeather";
import {weatherCopy} from "@/components/weather/weather-copy";
import {parseWeatherResponse,type WeatherResponse} from "@/components/weather/weather-data";
import {routing} from "@/i18n/routing";
import {getBackendUrl} from "@/lib/admin-backend";

export const dynamic="force-dynamic";
type Props=Readonly<{params:Promise<{locale:string}>}>;

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale}=await params;
  const c=weatherCopy(locale);
  return {
    title:c.title,
    description:c.description,
    alternates:{
      canonical:"/"+locale+"/weather",
      languages:Object.fromEntries(routing.locales.map(lang=>[lang,"/"+lang+"/weather"])),
    },
  };
}
export default async function WeatherHomePage({params}:Props){
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))notFound();
  setRequestLocale(locale);
  let initialData:WeatherResponse|null=null;
  try{
    const response=await fetch(getBackendUrl()+"/weather?continent=EU",{
      cache:"no-store",signal:AbortSignal.timeout(8000),
    });
    if(response.ok){
      const raw:unknown=await response.json();
      initialData=parseWeatherResponse(raw,"EU");
    }
  }catch{
    // The page and continent switcher remain accessible if the backend is down.
    // The retry button fetches via the browser-side Next.js proxy.
  }
  return <PublicWeather locale={locale} initialData={initialData}/>;
}
