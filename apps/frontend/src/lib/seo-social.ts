import type { Metadata } from "next";
import { SEO_SITE, type SeoLocale } from "./seo-metadata";

const LOCALE_TAG: Record<SeoLocale, string> = {
  fr: "fr_FR", en: "en_US", de: "de_DE", es: "es_ES",
  pt: "pt_PT", it: "it_IT", ru: "ru_RU", nl: "nl_NL",
};
export const SEO_BRAND_IMAGE = SEO_SITE + "/logo_lmn24.png";

type Copy = {
  homeTitle: string;
  category: string;
  source: string;
  hashtag: string;
  videoTitle: string;
  videoDescription: string;
  categoryDescription: (name: string) => string;
  sourceDescription: (name: string) => string;
  hashtagDescription: (name: string) => string;
};

export const SEO_COPY: Record<SeoLocale, Copy> = {
  fr: {homeTitle:"Actualités internationales",category:"Actualités",source:"Média",hashtag:"Sujet",videoTitle:"Vidéos du monde",videoDescription:"Découvrez les vidéos des médias internationaux sur LMN24.",categoryDescription:n=>`Retrouvez les dernières actualités de la rubrique ${n} sur LMN24.`,sourceDescription:n=>`Retrouvez les actualités publiées par ${n} sur LMN24.`,hashtagDescription:n=>`Suivez les articles et les tendances autour de ${n} sur LMN24.`},
  en: {homeTitle:"World news",category:"News",source:"Publisher",hashtag:"Topic",videoTitle:"World videos",videoDescription:"Explore videos from international news publishers on LMN24.",categoryDescription:n=>`Explore the latest ${n} news on LMN24.`,sourceDescription:n=>`Read news from ${n} on LMN24.`,hashtagDescription:n=>`Follow news and trending stories about ${n} on LMN24.`},
  de: {homeTitle:"Internationale Nachrichten",category:"Nachrichten",source:"Medienquelle",hashtag:"Thema",videoTitle:"Videos aus aller Welt",videoDescription:"Videos internationaler Nachrichtenmedien auf LMN24 entdecken.",categoryDescription:n=>`Aktuelle Nachrichten zu ${n} auf LMN24 lesen.`,sourceDescription:n=>`Nachrichten von ${n} auf LMN24 entdecken.`,hashtagDescription:n=>`Nachrichten und Trends rund um ${n} auf LMN24 verfolgen.`},
  es: {homeTitle:"Noticias internacionales",category:"Noticias",source:"Medio",hashtag:"Tema",videoTitle:"Vídeos del mundo",videoDescription:"Descubre vídeos de medios internacionales en LMN24.",categoryDescription:n=>`Descubre las últimas noticias de ${n} en LMN24.`,sourceDescription:n=>`Lee las noticias de ${n} en LMN24.`,hashtagDescription:n=>`Sigue las noticias y tendencias sobre ${n} en LMN24.`},
  pt: {homeTitle:"Notícias internacionais",category:"Notícias",source:"Fonte",hashtag:"Tema",videoTitle:"Vídeos do mundo",videoDescription:"Descubra vídeos dos meios de comunicação internacionais no LMN24.",categoryDescription:n=>`Acompanhe as últimas notícias de ${n} no LMN24.`,sourceDescription:n=>`Leia as notícias de ${n} no LMN24.`,hashtagDescription:n=>`Acompanhe notícias e tendências sobre ${n} no LMN24.`},
  it: {homeTitle:"Notizie internazionali",category:"Notizie",source:"Fonte",hashtag:"Argomento",videoTitle:"Video dal mondo",videoDescription:"Scopri i video dei media internazionali su LMN24.",categoryDescription:n=>`Leggi le ultime notizie su ${n} su LMN24.`,sourceDescription:n=>`Scopri le notizie di ${n} su LMN24.`,hashtagDescription:n=>`Segui notizie e tendenze su ${n} su LMN24.`},
  ru: {homeTitle:"Мировые новости",category:"Новости",source:"Источник",hashtag:"Тема",videoTitle:"Видео со всего мира",videoDescription:"Смотрите видео международных СМИ на LMN24.",categoryDescription:n=>`Читайте последние новости по теме «${n}» на LMN24.`,sourceDescription:n=>`Читайте новости издания «${n}» на LMN24.`,hashtagDescription:n=>`Следите за новостями и тенденциями по теме «${n}» на LMN24.`},
  nl: {homeTitle:"Wereldnieuws",category:"Nieuws",source:"Nieuwsbron",hashtag:"Onderwerp",videoTitle:"Video's uit de wereld",videoDescription:"Bekijk video's van internationale nieuwsmedia op LMN24.",categoryDescription:n=>`Lees het laatste nieuws over ${n} op LMN24.`,sourceDescription:n=>`Ontdek nieuws van ${n} op LMN24.`,hashtagDescription:n=>`Volg nieuws en trends over ${n} op LMN24.`},
};

export function cleanSeoText(value: string | null | undefined, max = 155): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  // Avoid unsafe control characters and unbounded descriptions from third parties.
  return cleaned.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

/**
 * Use only the first-party LMN24 logo: avoid remote hotlinked images, copyright
 * assumptions, and server-side requests to user-controlled URLs.
 */
export function seoSocial(locale: SeoLocale, title: string, description: string,
  url: string, image: string | null = SEO_BRAND_IMAGE): Pick<Metadata, "openGraph" | "twitter"> {
  const images = image ? [{url:image,width:192,height:192,alt:"LMN24"}] : undefined;
  return {
    openGraph: {type:"website",siteName:"LMN24",locale:LOCALE_TAG[locale],
      title,description,url,...(images?{images}:{})},
    twitter: {card: images ? "summary" : "summary",title,description,...(images?{images:[image!]}:{})},
  };
}
