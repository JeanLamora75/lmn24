import type { WesternZodiacSign } from "@/lib/visitor-zodiac";

export const VISITOR_ZODIAC_PREVIEW: Record<string, { heading: string; signs: Record<WesternZodiacSign, string> }> = {
  fr: { heading:"Votre signe", signs:{aries:"Bélier",taurus:"Taureau",gemini:"Gémeaux",cancer:"Cancer",leo:"Lion",virgo:"Vierge",libra:"Balance",scorpio:"Scorpion",sagittarius:"Sagittaire",capricorn:"Capricorne",aquarius:"Verseau",pisces:"Poissons"}},
  en: { heading:"Your sign", signs:{aries:"Aries",taurus:"Taurus",gemini:"Gemini",cancer:"Cancer",leo:"Leo",virgo:"Virgo",libra:"Libra",scorpio:"Scorpio",sagittarius:"Sagittarius",capricorn:"Capricorn",aquarius:"Aquarius",pisces:"Pisces"}},
  de: { heading:"Ihr Sternzeichen", signs:{aries:"Widder",taurus:"Stier",gemini:"Zwillinge",cancer:"Krebs",leo:"Löwe",virgo:"Jungfrau",libra:"Waage",scorpio:"Skorpion",sagittarius:"Schütze",capricorn:"Steinbock",aquarius:"Wassermann",pisces:"Fische"}},
  es: { heading:"Tu signo", signs:{aries:"Aries",taurus:"Tauro",gemini:"Géminis",cancer:"Cáncer",leo:"Leo",virgo:"Virgo",libra:"Libra",scorpio:"Escorpio",sagittarius:"Sagitario",capricorn:"Capricornio",aquarius:"Acuario",pisces:"Piscis"}},
  pt: { heading:"O seu signo", signs:{aries:"Carneiro",taurus:"Touro",gemini:"Gémeos",cancer:"Caranguejo",leo:"Leão",virgo:"Virgem",libra:"Balança",scorpio:"Escorpião",sagittarius:"Sagitário",capricorn:"Capricórnio",aquarius:"Aquário",pisces:"Peixes"}},
  it: { heading:"Il tuo segno", signs:{aries:"Ariete",taurus:"Toro",gemini:"Gemelli",cancer:"Cancro",leo:"Leone",virgo:"Vergine",libra:"Bilancia",scorpio:"Scorpione",sagittarius:"Sagittario",capricorn:"Capricorno",aquarius:"Acquario",pisces:"Pesci"}},
  ru: { heading:"Ваш знак", signs:{aries:"Овен",taurus:"Телец",gemini:"Близнецы",cancer:"Рак",leo:"Лев",virgo:"Дева",libra:"Весы",scorpio:"Скорпион",sagittarius:"Стрелец",capricorn:"Козерог",aquarius:"Водолей",pisces:"Рыбы"}},
  nl: { heading:"Jouw sterrenbeeld", signs:{aries:"Ram",taurus:"Stier",gemini:"Tweelingen",cancer:"Kreeft",leo:"Leeuw",virgo:"Maagd",libra:"Weegschaal",scorpio:"Schorpioen",sagittarius:"Boogschutter",capricorn:"Steenbok",aquarius:"Waterman",pisces:"Vissen"}},
};
