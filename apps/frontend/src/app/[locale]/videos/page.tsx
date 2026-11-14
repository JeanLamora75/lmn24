import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";
import { seoAlternates, type SeoLocale } from "@/lib/seo-metadata";
import { SEO_COPY, seoSocial } from "@/lib/seo-social";
import { PublicVideos, type VideosPage } from "@/components/videos/PublicVideos";
import { StructuredData } from "@/components/seo/StructuredData";
import { collectionSchema } from "@/lib/seo-schema";
export const dynamic="force-dynamic";
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale}=await params;
  if (!hasLocale(routing.locales,locale)) return {robots:{index:false}};
  const lang=locale as SeoLocale;
  const {videoTitle:title,videoDescription:description}=SEO_COPY[lang];
  return {title,description,alternates:seoAlternates(lang,"videos"),
    ...seoSocial(lang,title+" | LMN24",description,"https://www.lmn24.com/"+locale+"/videos")};
}
export default async function VideosPageRoute({params}:Props){
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))notFound();
  setRequestLocale(locale);
  let page:VideosPage|null=null;
  try{
    // Only the video collection is required: a failure of legacy filter endpoints
    // must never prevent languages such as en/de/pt from displaying videos.
    const videosResponse=await fetch(getBackendUrl()+"/public/videos?locale="+encodeURIComponent(locale),
      {cache:"no-store"});
    if(videosResponse.ok){
      page=await videosResponse.json() as VideosPage;
    }
  }catch{ /* displayed as retryable error */ }
  const copy=SEO_COPY[locale as SeoLocale];
  return <><StructuredData data={collectionSchema({locale:locale as SeoLocale,
    url:"https://www.lmn24.com/"+locale+"/videos",
    name:copy.videoTitle,description:copy.videoDescription})}/>
    <PublicVideos key={locale} locale={locale} initialPage={page}/></>;
}
