import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";
import { PublicVideos, type VideosPage, type VideosFilters } from "@/components/videos/PublicVideos";
export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale}=await params;
  return {title:locale==="fr"?"Vidéos du monde":"World videos",description:"Vidéos des médias internationaux, sélectionnées par langue."};
}
export default async function VideosPageRoute({params}:Props){
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))notFound();
  setRequestLocale(locale);
  let page:VideosPage|null=null,filters:VideosFilters|null=null;
  try{
    const [videosResponse,filtersResponse]=await Promise.all([
      fetch(getBackendUrl()+"/public/videos?locale="+encodeURIComponent(locale),{cache:"no-store"}),
      fetch(getBackendUrl()+"/public/videos/filters?locale="+encodeURIComponent(locale),{cache:"no-store"}),
    ]);
    if(videosResponse.ok&&filtersResponse.ok){
      page=await videosResponse.json() as VideosPage;
      filters=await filtersResponse.json() as VideosFilters;
    }
  }catch{ /* displayed as retryable error */ }
  return <PublicVideos key={locale} locale={locale} initialPage={page} initialFilters={filters}/>;
}
