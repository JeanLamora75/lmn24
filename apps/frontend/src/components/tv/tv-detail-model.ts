import {dateOffset,localToday,type TvAiring,type TvLocale} from "./tv-guide-model";

export type TvVariant={id:string;code:string;name:string;timeZone:string};
export type TvChannelDetails={
 countryIso2:string;referenceTimeZone:string;
 channel:{id:string;name:string;number:number;logoUrl:string|null;broadcastLanguages:string[]};
 variants:TvVariant[];defaultVariantId:string|null;officialLiveUrl:string|null;
};
export type TvGap={startsAt:string;endsAt:string;reason:"EPG_UNAVAILABLE"};
export type TvChannelDay={
 channelId:string;variantId:string;localDate:string;timeZone:string;
 airings:TvAiring[];gaps:TvGap[];coverageState:string;
 pagination:{page:number;pageSize:number;hasNext:boolean};
};
export type TvAiringDetails=TvAiring & {
 channel:{id:string;name:string;number:number};
 countryIso2:string;referenceTimeZone:string;variantTimeZone:string;
 variantId:string;season:number|null;episode:number|null;
};
export const DETAIL_COPY:Record<TvLocale,{
 back:string;grid:string;variant:string;clock:string;channelClock:string;visitorClock:string;
 previous:string;next:string;unavailable:string;empty:string;retry:string;
 loading:string;from:string;to:string;duration:string;category:string;description:string;
 noDescription:string;seeGrid:string;programmeGone:string;season:string;episode:string;
 country:string;language:string;original:string;live:string;dayOffset:string;
}> ={
 fr:{back:"Retour au Guide TV",grid:"Programmation",variant:"Variante de diffusion",clock:"Affichage de l’heure",
 channelClock:"Heure de la chaîne",visitorClock:"Mon heure locale",previous:"Jour précédent",next:"Jour suivant",
 unavailable:"Programme non disponible",empty:"Programme non disponible pour cette journée",retry:"Réessayer",
 loading:"Chargement de la grille…",from:"De",to:"à",duration:"Durée",category:"Catégorie",description:"Synopsis",
 noDescription:"Aucun synopsis disponible",seeGrid:"Voir la grille de cette chaîne",
 programmeGone:"Cette diffusion n’est plus disponible dans la grille actuelle.",season:"Saison",episode:"Épisode",
 country:"Pays",language:"Langue de diffusion",original:"Description dans la langue d’origine",
 live:"Regarder en direct",dayOffset:"Date locale du visiteur"},
 en:{back:"Back to TV guide",grid:"Schedule",variant:"Broadcast variant",clock:"Time display",
 channelClock:"Channel time",visitorClock:"My local time",previous:"Previous day",next:"Next day",
 unavailable:"Programme unavailable",empty:"No programme data for this day",retry:"Retry",loading:"Loading schedule…",
 from:"From",to:"to",duration:"Duration",category:"Category",description:"Synopsis",
 noDescription:"No synopsis available",seeGrid:"View this channel’s schedule",
 programmeGone:"This airing is no longer available in the current schedule.",season:"Season",episode:"Episode",
 country:"Country",language:"Broadcast language",original:"Original-language description",
 live:"Watch live",dayOffset:"Visitor local date"},
 de:{back:"Zurück zum TV-Programm",grid:"Programm",variant:"Sendevariante",clock:"Zeitanzeige",
 channelClock:"Senderzeit",visitorClock:"Meine Ortszeit",previous:"Vorheriger Tag",next:"Nächster Tag",
 unavailable:"Programm nicht verfügbar",empty:"Keine Programmdaten für diesen Tag",retry:"Erneut versuchen",loading:"Programm wird geladen…",
 from:"Von",to:"bis",duration:"Dauer",category:"Kategorie",description:"Beschreibung",noDescription:"Keine Beschreibung verfügbar",
 seeGrid:"Senderprogramm ansehen",programmeGone:"Diese Ausstrahlung ist nicht mehr im aktuellen Programm.",season:"Staffel",episode:"Folge",
 country:"Land",language:"Sendesprache",original:"Beschreibung in Originalsprache",live:"Live ansehen",dayOffset:"Lokales Datum des Besuchers"},
 es:{back:"Volver a la guía TV",grid:"Programación",variant:"Variante de emisión",clock:"Hora mostrada",
 channelClock:"Hora del canal",visitorClock:"Mi hora local",previous:"Día anterior",next:"Día siguiente",
 unavailable:"Programa no disponible",empty:"No hay información de programación para este día",retry:"Reintentar",loading:"Cargando programación…",
 from:"De",to:"a",duration:"Duración",category:"Categoría",description:"Sinopsis",noDescription:"Sin sinopsis disponible",
 seeGrid:"Ver la programación del canal",programmeGone:"Esta emisión ya no está disponible en la programación actual.",season:"Temporada",episode:"Episodio",
 country:"País",language:"Idioma de emisión",original:"Descripción en idioma original",live:"Ver en directo",dayOffset:"Fecha local del visitante"},
 pt:{back:"Voltar ao guia TV",grid:"Programação",variant:"Variante de emissão",clock:"Hora apresentada",
 channelClock:"Hora do canal",visitorClock:"Minha hora local",previous:"Dia anterior",next:"Dia seguinte",
 unavailable:"Programa indisponível",empty:"Sem informação de programação para este dia",retry:"Tentar novamente",loading:"A carregar a programação…",
 from:"De",to:"até",duration:"Duração",category:"Categoria",description:"Sinopse",noDescription:"Sem sinopse disponível",
 seeGrid:"Ver a programação do canal",programmeGone:"Esta emissão já não consta da programação atual.",season:"Temporada",episode:"Episódio",
 country:"País",language:"Idioma de emissão",original:"Descrição no idioma original",live:"Ver em direto",dayOffset:"Data local do visitante"},
 it:{back:"Torna alla guida TV",grid:"Programmazione",variant:"Variante di trasmissione",clock:"Visualizzazione ora",
 channelClock:"Ora del canale",visitorClock:"La mia ora locale",previous:"Giorno precedente",next:"Giorno successivo",
 unavailable:"Programma non disponibile",empty:"Nessun dato per questo giorno",retry:"Riprova",loading:"Caricamento programmi…",
 from:"Da",to:"a",duration:"Durata",category:"Categoria",description:"Trama",noDescription:"Nessuna trama disponibile",
 seeGrid:"Vedi il palinsesto del canale",programmeGone:"Questa trasmissione non è più disponibile nel palinsesto.",season:"Stagione",episode:"Episodio",
 country:"Paese",language:"Lingua di trasmissione",original:"Descrizione in lingua originale",live:"Guarda in diretta",dayOffset:"Data locale del visitatore"},
 ru:{back:"Назад к телепрограмме",grid:"Программа передач",variant:"Вариант вещания",clock:"Отображение времени",
 channelClock:"Время канала",visitorClock:"Моё местное время",previous:"Предыдущий день",next:"Следующий день",
 unavailable:"Программа недоступна",empty:"На этот день нет данных о программах",retry:"Повторить",loading:"Загрузка программы…",
 from:"С",to:"до",duration:"Длительность",category:"Категория",description:"Описание",noDescription:"Описание отсутствует",
 seeGrid:"Посмотреть программу канала",programmeGone:"Эта трансляция больше не доступна в текущем расписании.",season:"Сезон",episode:"Эпизод",
 country:"Страна",language:"Язык вещания",original:"Описание на языке оригинала",live:"Смотреть прямой эфир",dayOffset:"Местная дата зрителя"},
 nl:{back:"Terug naar tv-gids",grid:"Programma",variant:"Uitzendvariant",clock:"Tijdweergave",
 channelClock:"Zender tijd",visitorClock:"Mijn lokale tijd",previous:"Vorige dag",next:"Volgende dag",
 unavailable:"Programma niet beschikbaar",empty:"Geen programmagegevens voor deze dag",retry:"Opnieuw proberen",loading:"Programma laden…",
 from:"Van",to:"tot",duration:"Duur",category:"Categorie",description:"Samenvatting",noDescription:"Geen samenvatting beschikbaar",
 seeGrid:"Bekijk zenderprogramma",programmeGone:"Deze uitzending staat niet meer in het huidige programma.",season:"Seizoen",episode:"Aflevering",
 country:"Land",language:"Uitzendtaal",original:"Beschrijving in oorspronkelijke taal",live:"Live bekijken",dayOffset:"Lokale datum bezoeker"},
};
export function validTvId(id:string):boolean{
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
export function selectVariant(variants:readonly TvVariant[],preferred:string|null|undefined,defaultId:string|null):TvVariant|null{
 if(!variants.length)return null;
 return variants.find(v=>v.id===preferred)
  ??variants.find(v=>v.id===defaultId)
  ??[...variants].sort((a,b)=>a.code.localeCompare(b.code,"en")||a.id.localeCompare(b.id))[0]??null;
}
export function dayAtOffset(now:Date,variantZone:string,offset:number):string{
 return dateOffset(localToday(now,variantZone),offset);
}
export function offsetForDay(now:Date,variantZone:string,day:string):number|null{
 for(let n=0;n<=6;n++)if(dayAtOffset(now,variantZone,n)===day)return n;
 return null;
}
export function timeLabel(instant:string,zone:string,locale:string):string{
 return new Intl.DateTimeFormat(locale,{timeZone:zone,hour:"2-digit",minute:"2-digit",
  timeZoneName:"shortOffset"}).format(new Date(instant));
}
export function localDateLabel(instant:string,zone:string,locale:string):string{
 return new Intl.DateTimeFormat(locale,{timeZone:zone,day:"numeric",month:"short",year:"numeric"}).format(new Date(instant));
}
export function gapItems(airings:readonly TvAiring[],gaps:readonly TvGap[]){
 return [...airings.map(a=>({kind:"airing" as const,start:a.startsAt,id:a.id,airing:a})),
   ...gaps.map((g,i)=>({kind:"gap" as const,start:g.startsAt,id:"gap-"+i,gap:g}))]
  .sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id));
}
export function durationMinutes(start:string,end:string):number{
 return Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/60000));
}
export function approvedExternalUrl(value:string|null|undefined):string|null{
 if(!value)return null;
 try{const url=new URL(value);return url.protocol==="https:"?url.toString():null;}catch{return null;}
}
