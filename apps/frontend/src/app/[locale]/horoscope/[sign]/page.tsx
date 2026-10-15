import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

// Temporary destination for zodiac cards; complete reading UI is SCRUM-67.
const names:Record<string,string> = {
 aries:"♈",taurus:"♉",gemini:"♊",cancer:"♋",leo:"♌",virgo:"♍",
 libra:"♎",scorpio:"♏",sagittarius:"♐",capricorn:"♑",aquarius:"♒",pisces:"♓",
};
const copy:Record<string,{title:string,body:string,back:string}>={
 fr:{title:"Horoscope",body:"La consultation détaillée de ce signe sera disponible prochainement.",back:"Tous les signes"},
 en:{title:"Horoscope",body:"The detailed horoscope for this sign is coming soon.",back:"All signs"},
 de:{title:"Horoskop",body:"Das ausführliche Horoskop für dieses Zeichen folgt in Kürze.",back:"Alle Zeichen"},
 es:{title:"Horóscopo",body:"El horóscopo detallado de este signo estará disponible próximamente.",back:"Todos los signos"},
 pt:{title:"Horóscopo",body:"O horóscopo detalhado deste signo estará disponível em breve.",back:"Todos os signos"},
 it:{title:"Oroscopo",body:"L'oroscopo dettagliato di questo segno sarà disponibile a breve.",back:"Tutti i segni"},
 ru:{title:"Гороскоп",body:"Подробный гороскоп для этого знака скоро появится.",back:"Все знаки"},
 nl:{title:"Horoscoop",body:"De gedetailleerde horoscoop voor dit teken volgt binnenkort.",back:"Alle sterrenbeelden"},
};
export default async function HoroscopeSignPlaceholder({params}:{params:Promise<{locale:string,sign:string}>}){
 const {locale,sign}=await params;
 if(!hasLocale(routing.locales,locale)||!(sign in names))notFound();
 setRequestLocale(locale);
 const t=copy[locale]??copy.fr;
 return <main className="container py-5 text-center">
   <span className="display-1 text-primary" aria-hidden="true">{names[sign]}</span>
   <h1 className="h2 my-3">{t.title}</h1>
   <p className="text-body-secondary">{t.body}</p>
   <Link href={`/${locale}/horoscope`} className="btn btn-outline-primary">{t.back}</Link>
 </main>;
}
