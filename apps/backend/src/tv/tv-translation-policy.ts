/** SCRUM-123 — zero-loss TV description translation rules.
 * Persisted schema uses MACHINE; public UX calls that TRANSLATED.
 * Proposals must be explicitly approved and never replace existing text.
 */
export const TV_LOCALES=["fr","en","de","es","pt","it","ru","nl"] as const;
export type TvLocale=typeof TV_LOCALES[number];
export type StoredOrigin="SOURCE"|"MACHINE"|"MANUAL";
export type TranslationStatus="SOURCE"|"TRANSLATED"|"MANUAL"|"MISSING"|"FAILED"|"UNSUPPORTED";
export type DescriptionSnapshot={languageCode:string;content:string;origin:StoredOrigin;version:string};
export type AttemptSnapshot={languageCode:string;status:"SUCCESS"|"ERROR"|"UNSUPPORTED"};
export function statusForLanguage(language:TvLocale,descriptions:readonly DescriptionSnapshot[],
 attempts:readonly AttemptSnapshot[]):TranslationStatus{
 const description=descriptions.find(d=>d.languageCode===language);
 if(description)return description.origin==="MACHINE"?"TRANSLATED":description.origin;
 const attempt=attempts.find(a=>a.languageCode===language);
 return attempt?.status==="ERROR"?"FAILED":attempt?.status==="UNSUPPORTED"?"UNSUPPORTED":"MISSING";
}
export function retryLanguages(descriptions:readonly DescriptionSnapshot[],
 attempts:readonly AttemptSnapshot[],sourceLanguage:TvLocale):TvLocale[]{
 return TV_LOCALES.filter(language=>language!==sourceLanguage&&
  (statusForLanguage(language,descriptions,attempts)==="MISSING"||
   statusForLanguage(language,descriptions,attempts)==="FAILED"));
}
export function sanitizeTranslation(text:unknown):string|null{
 if(typeof text!=="string")return null;
 const value=text.trim();
 return value.length>0&&value.length<=10000&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)?value:null;
}
export function isTvLocale(v:string):v is TvLocale{
 return (TV_LOCALES as readonly string[]).includes(v);
}
