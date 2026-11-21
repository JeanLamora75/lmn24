/** Country labels for TV administration. Reuse the same i18n messages as the public site.
 * Load only the active locale to avoid bundling eight message dictionaries together.
 */
export const TV_COUNTRY_LOCALES = ["fr","en","de","es","it","pt","nl","ru"] as const;
export type TvCountryLocale = typeof TV_COUNTRY_LOCALES[number];
export type TvCountryNames = Readonly<Record<string,string>>;

const loaders:Record<TvCountryLocale,()=>Promise<{default:{countries?:Record<string,string>}}>>={
 fr:()=>import("../../../../messages/fr.json"),
 en:()=>import("../../../../messages/en.json"),
 de:()=>import("../../../../messages/de.json"),
 es:()=>import("../../../../messages/es.json"),
 it:()=>import("../../../../messages/it.json"),
 pt:()=>import("../../../../messages/pt.json"),
 nl:()=>import("../../../../messages/nl.json"),
 ru:()=>import("../../../../messages/ru.json"),
};

export function normalizeTvCountryLocale(locale:string):TvCountryLocale{
 const language=locale.trim().toLowerCase().split(/[-_]/)[0]??"fr";
 return TV_COUNTRY_LOCALES.find(x=>x===language)??"fr";
}

export async function loadTvCountryNames(locale:string):Promise<TvCountryNames>{
 const messages=await loaders[normalizeTvCountryLocale(locale)]();
 return messages.default.countries??{};
}

export function tvCountryName(iso:string,locale:string,names:TvCountryNames={}):string{
 const code=iso.trim().toUpperCase();
 if(!/^[A-Z]{2}$/.test(code))return code||iso;
 const translated=names[code];
 if(typeof translated==="string"&&translated.trim())return translated;
 try{
  return new Intl.DisplayNames([normalizeTvCountryLocale(locale),"fr"],{type:"region"}).of(code)??code;
 }catch{return code;}
}
