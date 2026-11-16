import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { seoAlternates, type SeoLocale } from "@/lib/seo-metadata";
import { seoSocial } from "@/lib/seo-social";
import { StructuredData } from "@/components/seo/StructuredData";
import { collectionSchema, pageBreadcrumbs } from "@/lib/seo-schema";
import { BiorhythmChart } from "@/components/horoscope/BiorhythmChart";
import { biorhythmCopy } from "@/components/horoscope/biorhythm-copy";

type Props = { params: Promise<{ locale:string }> };
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))return {};
  const copy=biorhythmCopy(locale);
  const url="https://www.lmn24.com/"+locale+"/horoscope/biorythmes";
  return {
    title:copy.title,description:copy.description,
    alternates:seoAlternates(locale as SeoLocale,"horoscope","biorythmes"),
    ...seoSocial(locale as SeoLocale,copy.title+" | LMN24",copy.description,url),
  };
}
export default async function BiorhythmPage({params}:Props){
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))notFound();
  setRequestLocale(locale);
  const copy=biorhythmCopy(locale);
  return <main className="container py-4 py-lg-5">
    <StructuredData data={collectionSchema({
      locale:locale as SeoLocale,
      url:"https://www.lmn24.com/"+locale+"/horoscope/biorythmes",
      name:copy.title,description:copy.description,
      breadcrumbs:pageBreadcrumbs(locale as SeoLocale,"Horoscope","horoscope",
        {title:copy.title,slug:"biorythmes"}),
    })}/>
    <Link href={`/${locale}/horoscope`} className="btn btn-outline-secondary mb-4">
      ← {copy.back}
    </Link>
    <header className="text-center mb-4 mb-lg-5">
      <h1 className="display-5 fw-bold">{copy.title}</h1>
      <p className="lead text-body-secondary">{copy.description}</p>
    </header>
    <BiorhythmChart locale={locale}/>
  </main>;
}
