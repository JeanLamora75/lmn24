import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

type Locale = "fr"|"en"|"de"|"es"|"pt"|"it"|"ru"|"nl";
const SIGNS = [
  ["aries","♈","21/03 – 19/04"],["taurus","♉","20/04 – 20/05"],
  ["gemini","♊","21/05 – 20/06"],["cancer","♋","21/06 – 22/07"],
  ["leo","♌","23/07 – 22/08"],["virgo","♍","23/08 – 22/09"],
  ["libra","♎","23/09 – 22/10"],["scorpio","♏","23/10 – 21/11"],
  ["sagittarius","♐","22/11 – 21/12"],["capricorn","♑","22/12 – 19/01"],
  ["aquarius","♒","20/01 – 18/02"],["pisces","♓","19/02 – 20/03"],
] as const;
const COPY: Record<Locale,{title:string;subtitle:string;choose:string;signs:string[]}> = {
 fr:{title:"Horoscope",subtitle:"Découvrez votre horoscope du jour et des sept prochains jours.",choose:"Consulter l'horoscope",signs:["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"]},
 en:{title:"Horoscope",subtitle:"Explore today's horoscope and the next seven days.",choose:"Read horoscope",signs:["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]},
 de:{title:"Horoskop",subtitle:"Entdecken Sie Ihr Horoskop für heute und die nächsten sieben Tage.",choose:"Horoskop lesen",signs:["Widder","Stier","Zwillinge","Krebs","Löwe","Jungfrau","Waage","Skorpion","Schütze","Steinbock","Wassermann","Fische"]},
 es:{title:"Horóscopo",subtitle:"Descubre tu horóscopo de hoy y de los próximos siete días.",choose:"Ver horóscopo",signs:["Aries","Tauro","Géminis","Cáncer","Leo","Virgo","Libra","Escorpio","Sagitario","Capricornio","Acuario","Piscis"]},
 pt:{title:"Horóscopo",subtitle:"Descubra o seu horóscopo de hoje e dos próximos sete dias.",choose:"Ver horóscopo",signs:["Carneiro","Touro","Gémeos","Caranguejo","Leão","Virgem","Balança","Escorpião","Sagitário","Capricórnio","Aquário","Peixes"]},
 it:{title:"Oroscopo",subtitle:"Scopri l'oroscopo di oggi e dei prossimi sette giorni.",choose:"Leggi l'oroscopo",signs:["Ariete","Toro","Gemelli","Cancro","Leone","Vergine","Bilancia","Scorpione","Sagittario","Capricorno","Acquario","Pesci"]},
 ru:{title:"Гороскоп",subtitle:"Гороскоп на сегодня и ближайшие семь дней.",choose:"Читать гороскоп",signs:["Овен","Телец","Близнецы","Рак","Лев","Дева","Весы","Скорпион","Стрелец","Козерог","Водолей","Рыбы"]},
 nl:{title:"Horoscoop",subtitle:"Ontdek je horoscoop voor vandaag en de komende zeven dagen.",choose:"Bekijk horoscoop",signs:["Ram","Stier","Tweelingen","Kreeft","Leeuw","Maagd","Weegschaal","Schorpioen","Boogschutter","Steenbok","Waterman","Vissen"]},
};
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale}=await params;const c=COPY[locale as Locale]??COPY.fr;
 return {title:c.title,description:c.subtitle,alternates:{canonical:`/${locale}/horoscope`,languages:Object.fromEntries(routing.locales.map(l=>[l,`/${l}/horoscope`]))}};
}
export default async function HoroscopeIndex({params}:Props){
 const {locale}=await params;
 if(!hasLocale(routing.locales,locale))notFound();
 setRequestLocale(locale);
 const copy=COPY[locale as Locale];
 return <main className="container py-4 py-lg-5">
   <header className="text-center mb-4 mb-lg-5"><h1 className="display-5 fw-bold">{copy.title}</h1>
     <p className="lead text-body-secondary">{copy.subtitle}</p></header>
   <div className="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-3 g-lg-4">
     {SIGNS.map(([slug,symbol,dates],i)=><div className="col" key={slug}>
       <Link href={`/${locale}/horoscope/${slug}`} className="card h-100 text-decoration-none text-body border shadow-sm text-center">
         <div className="card-body py-4 d-flex flex-column align-items-center">
           <span className="display-4 text-primary" aria-hidden="true">{symbol}</span>
           <h2 className="h5 fw-semibold mt-3">{copy.signs[i]}</h2>
           <p className="small text-body-secondary mb-3">{dates}</p>
           <span className="mt-auto text-primary small fw-semibold">{copy.choose} →</span>
         </div>
       </Link>
     </div>)}
   </div>
 </main>;
}
