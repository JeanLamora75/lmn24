/** SCRUM-74 — public weather copy, including all eight LMN24 locales. */
export const WEATHER_REGIONS = ["EU", "AS", "AF", "NA", "SA", "OC"] as const;
export type WeatherRegion = (typeof WEATHER_REGIONS)[number];
export type WeatherCopy = {
  title:string; description:string; choose:string; current:string; unavailable:string;
  oldData:string; updated:string; retry:string; empty:string; error:string;
  provider:string; loading:string; humidity:string; wind:string; felt:string;
  conditions:Record<"clear"|"mainlyClear"|"partlyCloudy"|"overcast"|"fog"|"drizzle"|"rain"|"snow"|"showers"|"storm"|"unknown",string>;
  regions:Record<WeatherRegion,string>;
};
const copy = {
  fr:{
    title:"Météo mondiale",description:"Le temps qu’il fait dans les grandes villes du monde, continent par continent.",
    choose:"Choisir un continent",current:"Conditions actuelles",unavailable:"Météo indisponible",
    oldData:"Données anciennes",updated:"Dernier relevé",retry:"Réessayer",empty:"Aucune ville active dans ce continent.",
    error:"Impossible de charger la météo pour le moment.",provider:"Données météo :",loading:"Chargement des villes…",
    humidity:"Humidité",wind:"Vent",felt:"Ressenti",
    conditions:{clear:"Ciel dégagé",mainlyClear:"Peu nuageux",partlyCloudy:"Partiellement nuageux",overcast:"Couvert",fog:"Brouillard",drizzle:"Bruine",rain:"Pluie",snow:"Neige",showers:"Averses",storm:"Orage",unknown:"Conditions non renseignées"},
    regions:{EU:"Europe",AS:"Asie",AF:"Afrique",NA:"Amérique du Nord",SA:"Amérique du Sud",OC:"Océanie"},
  },
  en:{
    title:"World weather",description:"Current weather in major cities around the world, one continent at a time.",
    choose:"Choose a continent",current:"Current conditions",unavailable:"Weather unavailable",
    oldData:"Outdated observations",updated:"Last observation",retry:"Try again",empty:"No active cities on this continent.",
    error:"Weather data could not be loaded.",provider:"Weather data:",loading:"Loading cities…",
    humidity:"Humidity",wind:"Wind",felt:"Feels like",
    conditions:{clear:"Clear sky",mainlyClear:"Mainly clear",partlyCloudy:"Partly cloudy",overcast:"Overcast",fog:"Fog",drizzle:"Drizzle",rain:"Rain",snow:"Snow",showers:"Showers",storm:"Thunderstorm",unknown:"Conditions unknown"},
    regions:{EU:"Europe",AS:"Asia",AF:"Africa",NA:"North America",SA:"South America",OC:"Oceania"},
  },
  de:{
    title:"Wetter weltweit",description:"Das aktuelle Wetter in Metropolen rund um die Welt, nach Kontinent geordnet.",
    choose:"Kontinent wählen",current:"Aktuelles Wetter",unavailable:"Wetter nicht verfügbar",
    oldData:"Veraltete Daten",updated:"Letzte Messung",retry:"Erneut versuchen",empty:"Keine aktiven Städte auf diesem Kontinent.",
    error:"Wetterdaten können derzeit nicht geladen werden.",provider:"Wetterdaten:",loading:"Städte werden geladen…",
    humidity:"Luftfeuchtigkeit",wind:"Wind",felt:"Gefühlt",
    conditions:{clear:"Klarer Himmel",mainlyClear:"Überwiegend klar",partlyCloudy:"Teilweise bewölkt",overcast:"Bedeckt",fog:"Nebel",drizzle:"Nieselregen",rain:"Regen",snow:"Schnee",showers:"Schauer",storm:"Gewitter",unknown:"Wetter unbekannt"},
    regions:{EU:"Europa",AS:"Asien",AF:"Afrika",NA:"Nordamerika",SA:"Südamerika",OC:"Ozeanien"},
  },
  es:{
    title:"El tiempo en el mundo",description:"El tiempo actual en grandes ciudades del mundo, continente a continente.",
    choose:"Elegir continente",current:"Condiciones actuales",unavailable:"Tiempo no disponible",
    oldData:"Datos antiguos",updated:"Última observación",retry:"Reintentar",empty:"No hay ciudades activas en este continente.",
    error:"No se pueden cargar los datos meteorológicos.",provider:"Datos meteorológicos:",loading:"Cargando ciudades…",
    humidity:"Humedad",wind:"Viento",felt:"Sensación",
    conditions:{clear:"Cielo despejado",mainlyClear:"Casi despejado",partlyCloudy:"Parcialmente nublado",overcast:"Nublado",fog:"Niebla",drizzle:"Llovizna",rain:"Lluvia",snow:"Nieve",showers:"Chubascos",storm:"Tormenta",unknown:"Condiciones desconocidas"},
    regions:{EU:"Europa",AS:"Asia",AF:"África",NA:"América del Norte",SA:"América del Sur",OC:"Oceanía"},
  },
  pt:{
    title:"Meteorologia mundial",description:"O tempo atual nas principais cidades do mundo, continente a continente.",
    choose:"Escolher continente",current:"Condições atuais",unavailable:"Tempo indisponível",
    oldData:"Dados antigos",updated:"Última observação",retry:"Tentar novamente",empty:"Não existem cidades ativas neste continente.",
    error:"Não foi possível carregar os dados meteorológicos.",provider:"Dados meteorológicos:",loading:"A carregar cidades…",
    humidity:"Humidade",wind:"Vento",felt:"Sensação térmica",
    conditions:{clear:"Céu limpo",mainlyClear:"Pouco nublado",partlyCloudy:"Parcialmente nublado",overcast:"Encoberto",fog:"Nevoeiro",drizzle:"Chuvisco",rain:"Chuva",snow:"Neve",showers:"Aguaceiros",storm:"Trovoada",unknown:"Condições desconhecidas"},
    regions:{EU:"Europa",AS:"Ásia",AF:"África",NA:"América do Norte",SA:"América do Sul",OC:"Oceânia"},
  },
  it:{
    title:"Meteo nel mondo",description:"Le condizioni meteo nelle grandi città del mondo, continente per continente.",
    choose:"Scegli un continente",current:"Condizioni attuali",unavailable:"Meteo non disponibile",
    oldData:"Dati non aggiornati",updated:"Ultima rilevazione",retry:"Riprova",empty:"Nessuna città attiva in questo continente.",
    error:"Impossibile caricare i dati meteo.",provider:"Dati meteo:",loading:"Caricamento città…",
    humidity:"Umidità",wind:"Vento",felt:"Percepita",
    conditions:{clear:"Sereno",mainlyClear:"Poco nuvoloso",partlyCloudy:"Parzialmente nuvoloso",overcast:"Coperto",fog:"Nebbia",drizzle:"Pioviggine",rain:"Pioggia",snow:"Neve",showers:"Rovesci",storm:"Temporale",unknown:"Condizioni sconosciute"},
    regions:{EU:"Europa",AS:"Asia",AF:"Africa",NA:"America del Nord",SA:"America del Sud",OC:"Oceania"},
  },
  ru:{
    title:"Погода в мире",description:"Погода в крупных городах мира с разбивкой по континентам.",
    choose:"Выберите континент",current:"Текущая погода",unavailable:"Данные о погоде недоступны",
    oldData:"Устаревшие данные",updated:"Последнее наблюдение",retry:"Повторить",empty:"На этом континенте нет активных городов.",
    error:"Не удалось загрузить данные о погоде.",provider:"Источник погоды:",loading:"Загрузка городов…",
    humidity:"Влажность",wind:"Ветер",felt:"Ощущается как",
    conditions:{clear:"Ясно",mainlyClear:"Преимущественно ясно",partlyCloudy:"Переменная облачность",overcast:"Пасмурно",fog:"Туман",drizzle:"Морось",rain:"Дождь",snow:"Снег",showers:"Ливни",storm:"Гроза",unknown:"Погода неизвестна"},
    regions:{EU:"Европа",AS:"Азия",AF:"Африка",NA:"Северная Америка",SA:"Южная Америка",OC:"Океания"},
  },
  nl:{
    title:"Wereldweer",description:"Het actuele weer in grote steden over de hele wereld, per continent.",
    choose:"Kies een continent",current:"Huidig weer",unavailable:"Weer niet beschikbaar",
    oldData:"Verouderde gegevens",updated:"Laatste meting",retry:"Opnieuw proberen",empty:"Geen actieve steden op dit continent.",
    error:"Weergegevens kunnen niet worden geladen.",provider:"Weergegevens:",loading:"Steden laden…",
    humidity:"Vochtigheid",wind:"Wind",felt:"Gevoelstemperatuur",
    conditions:{clear:"Helder",mainlyClear:"Vrij helder",partlyCloudy:"Halfbewolkt",overcast:"Bewolkt",fog:"Mist",drizzle:"Motregen",rain:"Regen",snow:"Sneeuw",showers:"Buien",storm:"Onweer",unknown:"Onbekende omstandigheden"},
    regions:{EU:"Europa",AS:"Azië",AF:"Afrika",NA:"Noord-Amerika",SA:"Zuid-Amerika",OC:"Oceanië"},
  },
} satisfies Record<string,WeatherCopy>;

export type WeatherLocale = keyof typeof copy;
export function weatherCopy(locale:string):WeatherCopy{
  return copy[locale as WeatherLocale] ?? copy.fr;
}
export function weatherCondition(code:number):keyof WeatherCopy["conditions"]{
  if(code===0)return "clear";
  if(code===1)return "mainlyClear";
  if(code===2)return "partlyCloudy";
  if(code===3)return "overcast";
  if(code===45||code===48)return "fog";
  if(code>=51&&code<=57)return "drizzle";
  if(code>=61&&code<=67)return "rain";
  if(code>=71&&code<=77)return "snow";
  if(code>=80&&code<=86)return "showers";
  if(code>=95&&code<=99)return "storm";
  return "unknown";
}
