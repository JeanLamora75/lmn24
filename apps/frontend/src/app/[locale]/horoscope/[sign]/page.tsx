import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";
const SIGNS = ["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"] as const;
const SYMBOLS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
type Locale = "fr"|"en"|"de"|"es"|"pt"|"it"|"ru"|"nl";
type Labels = { title:string; back:string; today:string; tomorrow:string; unavailable:string; serviceError:string; sections:[string,string,string,string]; select:string; disclaimer:string; signs:string[] };
const TEXT:Record<Locale,Labels> = {
 fr:{title:"Horoscope",back:"Tous les signes",today:"Aujourd’hui",tomorrow:"Demain",unavailable:"L’horoscope de cette date n’est pas encore disponible.",serviceError:"La consultation est momentanément indisponible.",sections:["Général","Amour","Travail","Finances"],select:"Choisir une date",disclaimer:"À titre de divertissement",signs:["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"]},
 en:{title:"Horoscope",back:"All signs",today:"Today",tomorrow:"Tomorrow",unavailable:"The horoscope for this date is not available yet.",serviceError:"Horoscopes are temporarily unavailable.",sections:["General","Love","Work","Finances"],select:"Choose a date",disclaimer:"For entertainment purposes",signs:["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]},
 de:{title:"Horoskop",back:"Alle Zeichen",today:"Heute",tomorrow:"Morgen",unavailable:"Das Horoskop für dieses Datum ist noch nicht verfügbar.",serviceError:"Horoskope sind vorübergehend nicht verfügbar.",sections:["Allgemein","Liebe","Beruf","Finanzen"],select:"Datum wählen",disclaimer:"Zur Unterhaltung",signs:["Widder","Stier","Zwillinge","Krebs","Löwe","Jungfrau","Waage","Skorpion","Schütze","Steinbock","Wassermann","Fische"]},
 es:{title:"Horóscopo",back:"Todos los signos",today:"Hoy",tomorrow:"Mañana",unavailable:"El horóscopo para esta fecha aún no está disponible.",serviceError:"El horóscopo no está disponible temporalmente.",sections:["General","Amor","Trabajo","Finanzas"],select:"Elegir fecha",disclaimer:"Solo para entretenimiento",signs:["Aries","Tauro","Géminis","Cáncer","Leo","Virgo","Libra","Escorpio","Sagitario","Capricornio","Acuario","Piscis"]},
 pt:{title:"Horóscopo",back:"Todos os signos",today:"Hoje",tomorrow:"Amanhã",unavailable:"O horóscopo desta data ainda não está disponível.",serviceError:"Os horóscopos estão temporariamente indisponíveis.",sections:["Geral","Amor","Trabalho","Finanças"],select:"Escolher uma data",disclaimer:"Para entretenimento",signs:["Carneiro","Touro","Gémeos","Caranguejo","Leão","Virgem","Balança","Escorpião","Sagitário","Capricórnio","Aquário","Peixes"]},
 it:{title:"Oroscopo",back:"Tutti i segni",today:"Oggi",tomorrow:"Domani",unavailable:"L'oroscopo per questa data non è ancora disponibile.",serviceError:"Gli oroscopi sono temporaneamente non disponibili.",sections:["Generale","Amore","Lavoro","Finanze"],select:"Scegli una data",disclaimer:"A scopo di intrattenimento",signs:["Ariete","Toro","Gemelli","Cancro","Leone","Vergine","Bilancia","Scorpione","Sagittario","Capricorno","Acquario","Pesci"]},
 ru:{title:"Гороскоп",back:"Все знаки",today:"Сегодня",tomorrow:"Завтра",unavailable:"Гороскоп на эту дату пока недоступен.",serviceError:"Гороскопы временно недоступны.",sections:["Общее","Любовь","Работа","Финансы"],select:"Выберите дату",disclaimer:"Только для развлечения",signs:["Овен","Телец","Близнецы","Рак","Лев","Дева","Весы","Скорпион","Стрелец","Козерог","Водолей","Рыбы"]},
 nl:{title:"Horoscoop",back:"Alle sterrenbeelden",today:"Vandaag",tomorrow:"Morgen",unavailable:"De horoscoop voor deze datum is nog niet beschikbaar.",serviceError:"Horoscopen zijn tijdelijk niet beschikbaar.",sections:["Algemeen","Liefde","Werk","Financiën"],select:"Kies een datum",disclaimer:"Ter vermaak",signs:["Ram","Stier","Tweelingen","Kreeft","Leeuw","Maagd","Weegschaal","Schorpioen","Boogschutter","Steenbok","Waterman","Vissen"]},
};
type Horoscope = {available:boolean;date:string;sign:string;language:string;general?:string;love?:string;work?:string;finance?:string;disclaimer?:string;astronomy?:{validationStatus?:string|null;attribution?:{text?:string|null;url?:string|null}}};
type Props={params:Promise<{locale:string;sign:string}>;searchParams:Promise<{date?:string|string[]}>};
function daysFromParis():string[] {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const part=(name:string)=>parts.find(p=>p.type===name)?.value??"";
 const start=new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
 return Array.from({length:8},(_,i)=>new Date(start.getTime()+i*86400000).toISOString().slice(0,10));
}
function titleFor(locale:Locale,sign:string){
 const i=SIGNS.indexOf(sign as typeof SIGNS[number]);
 return i<0?"":TEXT[locale].signs[i];
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,sign}=await params;
 if(!hasLocale(routing.locales,locale)||!SIGNS.some(s=>s===sign))return {};
 const name=titleFor(locale as Locale,sign);
 return {title:`${TEXT[locale as Locale].title} — ${name}`,description:`${TEXT[locale as Locale].title} ${name}`,
   alternates:{canonical:`/${locale}/horoscope/${sign}`,languages:Object.fromEntries(routing.locales.map(l=>[l,`/${l}/horoscope/${sign}`]))}};
}
export default async function HoroscopeSignPage({params,searchParams}:Props){
 const {locale,sign}=await params;
 if(!hasLocale(routing.locales,locale)||!SIGNS.some(s=>s===sign))notFound();
 setRequestLocale(locale);
 const lang=locale as Locale,t=TEXT[lang],index=SIGNS.indexOf(sign as typeof SIGNS[number]);
 const days=daysFromParis(),query=(await searchParams).date;
 const selected=typeof query==="string"?query:days[0];
 if(!days.includes(selected))notFound();
 let horoscope:Horoscope|null=null;
 let serviceFailed=false;
 try{
   const response=await fetch(`${getBackendUrl()}/public/horoscopes/${sign}?locale=${lang}&date=${selected}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(!response.ok)serviceFailed=true;
   else horoscope=await response.json() as Horoscope;
 }catch{serviceFailed=true;}
 const when=(day:string)=>new Intl.DateTimeFormat(lang,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z"));
 const name=t.signs[index];
 const attr=horoscope?.astronomy?.attribution;
 // The source file explicitly requires a visible CosmyDay link on pages using its data.
 const attrUrl=attr?.url==="https://cosmyday.com"||attr?.url==="https://www.cosmyday.com"?attr.url:"https://cosmyday.com";
 return <main className="container py-4 py-lg-5">
   <Link href={`/${locale}/horoscope`} className="btn btn-outline-secondary mb-4">← {t.back}</Link>
   <header className="text-center mb-4">
     <div className="display-2 text-primary" aria-hidden="true">{SYMBOLS[index]}</div>
     <h1 className="display-6 fw-semibold">{t.title} — {name}</h1>
   </header>
   <nav aria-label={t.select} className="d-flex flex-wrap gap-2 justify-content-center mb-4">
     {days.map((day,i)=><Link key={day} href={`/${locale}/horoscope/${sign}?date=${day}`}
       aria-current={selected===day?"date":undefined}
       className={`btn ${selected===day?"btn-primary":"btn-outline-primary"} d-flex flex-column align-items-center`}>
       <span className="small">{i===0?t.today:i===1?t.tomorrow:when(day)}</span>
       <span className="small">{day.slice(8,10)}/{day.slice(5,7)}</span>
     </Link>)}
   </nav>
   <h2 className="h4 text-center mb-4"><time dateTime={selected}>{new Intl.DateTimeFormat(lang,{dateStyle:"full",timeZone:"UTC"}).format(new Date(selected+"T12:00:00Z"))}</time></h2>
   {serviceFailed?<p className="alert alert-warning" role="status">{t.serviceError}</p>
   :!horoscope?.available?<p className="alert alert-light border text-center" role="status">{t.unavailable}</p>
   :<article className="mx-auto" style={{maxWidth:"900px"}}>
     {(["general","love","work","finance"] as const).map((key,i)=>
       <section key={key} className="card mb-3"><div className="card-body p-4">
         <h3 className="h5 fw-semibold text-primary">{t.sections[i]}</h3>
         <p className="mb-0" style={{whiteSpace:"pre-line"}}>{horoscope[key]}</p>
       </div></section>)}
     <p className="small text-body-secondary mt-4">{horoscope.disclaimer||t.disclaimer}</p>
     <p className="small text-body-secondary">
       <a href={attrUrl} target="_blank" rel="noopener noreferrer">{attr?.text||"Astronomical data: CosmyDay"}</a>
     </p>
   </article>}
 </main>;
}
