export const TV_TABS = ["CHANNELS","NOW","TONIGHT","LATE"] as const;
export type TvTab = typeof TV_TABS[number];
export type TvCountry={countryIso2:string;label:string;referenceTimeZone:string};
export type TvProgrammeState="AVAILABLE"|"EPG_UNAVAILABLE"|"NO_START_IN_WINDOW";
export type TvAiring={id:string;startsAt:string;endsAt:string;title:string;
 category:string|null;description:string|null;imageUrl:string|null};
export type TvScheduleItem={
 channel:{id:string;number:number;name:string;logoUrl:string|null;
   broadcastLanguages?:string[]};
 variant:{id:string;timeZone:string}|null;
 programmeState:TvProgrammeState;airing:TvAiring|null;coverageState?:string;
};
export type TvSchedule={
 countryIso2:string;referenceTimeZone:string;localDate:string;tab:TvTab;
 items:TvScheduleItem[];pagination:{page:number;pageSize:number;hasNext:boolean};
};
const locales=["fr","en","de","es","pt","it","ru","nl"] as const;
export type TvLocale=typeof locales[number];
export function tvLocale(value:string):TvLocale{
 return locales.includes(value as TvLocale)?value as TvLocale:"fr";
}
export function localToday(now:Date,zone:string):string{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",
  month:"2-digit",day:"2-digit"}).formatToParts(now);
 const get=(name:string)=>parts.find(p=>p.type===name)?.value;
 return `${get("year")}-${get("month")}-${get("day")}`;
}
export function dateOffset(iso:string,days:number):string{
 const date=new Date(iso+"T00:00:00Z");
 if(!Number.isFinite(date.getTime())||!Number.isInteger(days))throw new Error("Invalid date");
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}
export function resolveCountry(countries:readonly TvCountry[],preferred:string|null,locale:string):TvCountry|null{
 if(!countries.length)return null;
 const preferredCountry=countries.find(c=>c.countryIso2.toUpperCase()===preferred?.toUpperCase());
 if(preferredCountry)return preferredCountry;
 const fallback:{[key:string]:string}={fr:"FR",en:"GB",de:"DE",es:"ES",pt:"PT",it:"IT",ru:"RU",nl:"NL"};
 const matched=countries.find(c=>c.countryIso2.toUpperCase()===fallback[locale]);
 if(matched)return matched;
 return [...countries].sort((a,b)=>a.countryIso2.localeCompare(b.countryIso2,"en"))[0]??null;
}
export function moveDate(dayIndex:number,tab:TvTab,step:-1|1):{dayIndex:number;tab:TvTab;notice:boolean}{
 const next=Math.max(0,Math.min(6,dayIndex+step));
 return {dayIndex:next,tab:tab==="NOW"&&next>0?"TONIGHT":tab,
  notice:tab==="NOW"&&next>0};
}
export function formatBroadcast(instant:string,zone:string,locale:string):string{
 return new Intl.DateTimeFormat(locale,{hour:"2-digit",minute:"2-digit",timeZone:zone}).format(new Date(instant));
}
export function filterBroadcastLanguage(items:readonly TvScheduleItem[],language:string):TvScheduleItem[]{
 if(language==="all")return [...items];
 return items.filter(i=>i.channel.broadcastLanguages?.some(l=>l.toLowerCase()===language));
}
export type Copy={title:string;subtitle:string;search:string;country:string;language:string;
 allLanguages:string;clock:string;channelClock:string;visitorClock:string;
 tabs:[string,string,string,string];empty:string;missing:string;noStart:string;
 retry:string;loading:string;next:string;previous:string;changeNow:string;
 error:string;resetLanguage:string;noLanguage:string;channelNumber:string;duration:string;
 stale:string;searchSoon:string;categoryFallback:string};
export const TV_COPY:Record<TvLocale,Copy>={
 fr:{title:"Programme TV",subtitle:"Les chaînes nationales gratuites et leurs programmes.",
 search:"Rechercher parmi tous les pays",country:"Pays",language:"Langue de diffusion",allLanguages:"Toutes les langues",
 clock:"Affichage de l’heure",channelClock:"Heure de la chaîne",visitorClock:"Mon heure locale",
 tabs:["Chaînes","En ce moment","Ce soir","2ème partie"],empty:"Aucune chaîne disponible pour ce pays.",
 missing:"Programme non disponible",noStart:"Aucun programme débutant sur cette plage",
 retry:"Réessayer",loading:"Chargement des programmes…",next:"Jour suivant",previous:"Jour précédent",
 changeNow:"En ce moment est disponible uniquement aujourd’hui. Affichage de Ce soir.",
 error:"Impossible de charger les programmes.",resetLanguage:"Toutes les langues",
 noLanguage:"Aucune chaîne dans cette langue.",channelNumber:"Chaîne n°",duration:"Durée",
 stale:"La dernière grille est conservée ; les informations peuvent être anciennes.",
 searchSoon:"La recherche mondiale sera disponible avec son écran dédié.",categoryFallback:"Illustration de catégorie"},
 en:{title:"TV Guide",subtitle:"Free national channels and their schedules.",search:"Search all countries",
 country:"Country",language:"Broadcast language",allLanguages:"All languages",clock:"Time display",
 channelClock:"Channel time",visitorClock:"My local time",
 tabs:["Channels","On now","Tonight","Late night"],empty:"No channels available for this country.",
 missing:"Programme unavailable",noStart:"No programme starts in this window",retry:"Try again",
 loading:"Loading schedules…",next:"Next day",previous:"Previous day",
 changeNow:"On now is available only today. Showing Tonight.",error:"Unable to load schedules.",
 resetLanguage:"All languages",noLanguage:"No channels in this language.",
 channelNumber:"Channel No.",duration:"Duration",
 stale:"Previous schedule retained; information may be outdated.",
 searchSoon:"Global search will be available in its dedicated screen.",categoryFallback:"Category illustration"},
 de:{title:"TV-Programm",subtitle:"Kostenlose nationale Sender und ihr Programm.",search:"Weltweit suchen",
 country:"Land",language:"Sendesprache",allLanguages:"Alle Sprachen",clock:"Zeitanzeige",
 channelClock:"Senderzeit",visitorClock:"Meine Ortszeit",tabs:["Sender","Jetzt","Heute Abend","Spätprogramm"],
 empty:"Keine Sender für dieses Land.",missing:"Programm nicht verfügbar",
 noStart:"Kein Programm beginnt in diesem Zeitraum",retry:"Erneut versuchen",loading:"Programm wird geladen…",
 next:"Nächster Tag",previous:"Vorheriger Tag",changeNow:"Jetzt ist nur heute verfügbar. Heute Abend wird angezeigt.",
 error:"Programm kann nicht geladen werden.",resetLanguage:"Alle Sprachen",noLanguage:"Keine Sender in dieser Sprache.",
 channelNumber:"Sender Nr.",duration:"Dauer",stale:"Vorheriges Programm; möglicherweise veraltet.",
 searchSoon:"Die weltweite Suche erhält eine eigene Seite.",categoryFallback:"Kategorieillustration"},
 es:{title:"Guía TV",subtitle:"Canales nacionales gratuitos y su programación.",search:"Buscar en todos los países",
 country:"País",language:"Idioma de emisión",allLanguages:"Todos los idiomas",clock:"Hora mostrada",
 channelClock:"Hora del canal",visitorClock:"Mi hora local",tabs:["Canales","Ahora","Esta noche","Segunda parte"],
 empty:"No hay canales para este país.",missing:"Programa no disponible",noStart:"Ningún programa comienza en esta franja",
 retry:"Reintentar",loading:"Cargando programación…",next:"Día siguiente",previous:"Día anterior",
 changeNow:"Ahora solo está disponible hoy. Se muestra Esta noche.",error:"No se pudo cargar la programación.",
 resetLanguage:"Todos los idiomas",noLanguage:"No hay canales en este idioma.",
 channelNumber:"Canal n.º",duration:"Duración",stale:"La programación anterior puede estar desactualizada.",
 searchSoon:"La búsqueda global tendrá su propia página.",categoryFallback:"Ilustración de categoría"},
 pt:{title:"Guia TV",subtitle:"Canais nacionais gratuitos e programação.",search:"Pesquisar todos os países",
 country:"País",language:"Idioma de transmissão",allLanguages:"Todos os idiomas",clock:"Hora apresentada",
 channelClock:"Hora do canal",visitorClock:"Minha hora local",tabs:["Canais","Agora","Esta noite","Mais tarde"],
 empty:"Não há canais para este país.",missing:"Programa indisponível",noStart:"Nenhum programa começa neste período",
 retry:"Tentar novamente",loading:"A carregar a programação…",next:"Dia seguinte",previous:"Dia anterior",
 changeNow:"Agora só está disponível hoje. A mostrar Esta noite.",error:"Não foi possível carregar a programação.",
 resetLanguage:"Todos os idiomas",noLanguage:"Não há canais neste idioma.",
 channelNumber:"Canal n.º",duration:"Duração",stale:"A programação anterior poderá estar desatualizada.",
 searchSoon:"A pesquisa mundial terá uma página própria.",categoryFallback:"Ilustração de categoria"},
 it:{title:"Guida TV",subtitle:"Canali nazionali gratuiti e programmi.",search:"Cerca in tutti i paesi",
 country:"Paese",language:"Lingua di trasmissione",allLanguages:"Tutte le lingue",clock:"Visualizzazione ora",
 channelClock:"Ora del canale",visitorClock:"La mia ora locale",tabs:["Canali","Adesso","Stasera","Seconda serata"],
 empty:"Nessun canale disponibile per questo paese.",missing:"Programma non disponibile",
 noStart:"Nessun programma inizia in questa fascia",retry:"Riprova",loading:"Caricamento programmi…",
 next:"Giorno successivo",previous:"Giorno precedente",changeNow:"Adesso è disponibile solo oggi. Visualizzazione Stasera.",
 error:"Impossibile caricare i programmi.",resetLanguage:"Tutte le lingue",noLanguage:"Nessun canale in questa lingua.",
 channelNumber:"Canale n.",duration:"Durata",stale:"Programmazione precedente potenzialmente obsoleta.",
 searchSoon:"La ricerca globale avrà una pagina dedicata.",categoryFallback:"Illustrazione della categoria"},
 ru:{title:"Телепрограмма",subtitle:"Бесплатные национальные каналы и программы.",search:"Поиск по всем странам",
 country:"Страна",language:"Язык вещания",allLanguages:"Все языки",clock:"Отображение времени",
 channelClock:"Время канала",visitorClock:"Моё местное время",tabs:["Каналы","Сейчас","Сегодня вечером","Поздний эфир"],
 empty:"Нет доступных каналов для этой страны.",missing:"Программа недоступна",
 noStart:"В это время передачи не начинаются",retry:"Повторить",loading:"Загрузка программы…",
 next:"Следующий день",previous:"Предыдущий день",changeNow:"«Сейчас» доступно только сегодня. Показан вечер.",
 error:"Не удалось загрузить программу.",resetLanguage:"Все языки",noLanguage:"Нет каналов на этом языке.",
 channelNumber:"Канал №",duration:"Длительность",stale:"Предыдущая программа может быть устаревшей.",
 searchSoon:"Глобальный поиск появится на отдельной странице.",categoryFallback:"Иллюстрация категории"},
 nl:{title:"Tv-gids",subtitle:"Gratis nationale zenders en hun programma's.",search:"Zoek in alle landen",
 country:"Land",language:"Uitzendtaal",allLanguages:"Alle talen",clock:"Tijdweergave",
 channelClock:"Zender tijd",visitorClock:"Mijn lokale tijd",tabs:["Zenders","Nu","Vanavond","Later"],
 empty:"Geen zenders beschikbaar voor dit land.",missing:"Programma niet beschikbaar",
 noStart:"Geen programma begint in dit tijdvak",retry:"Opnieuw proberen",loading:"Programma's laden…",
 next:"Volgende dag",previous:"Vorige dag",changeNow:"Nu is alleen vandaag beschikbaar. Vanavond wordt getoond.",
 error:"Programma's konden niet worden geladen.",resetLanguage:"Alle talen",noLanguage:"Geen zenders in deze taal.",
 channelNumber:"Zender nr.",duration:"Duur",stale:"Vorig programma kan verouderd zijn.",
 searchSoon:"Wereldwijd zoeken krijgt een aparte pagina.",categoryFallback:"Categorie-illustratie"},
};
