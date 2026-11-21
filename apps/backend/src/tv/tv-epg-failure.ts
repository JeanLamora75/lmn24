/** Sanitized, stable diagnostics for an external EPG import.
 * No URL, response body, raw upstream error or secrets may reach admin events.
 */
export type EpgFailureCode =
 "EPG_HTTP_404"|"EPG_HTTP_403"|"EPG_HTTP_429"|"EPG_HTTP_5XX"|
 "EPG_HTTP_REDIRECT"|"EPG_HTTP_ERROR"|"EPG_DNS_ERROR"|
 "EPG_TIMEOUT"|"EPG_SIZE_LIMIT"|"EPG_XMLTV_INVALID"|
 "EPG_NO_PROGRAMMES"|"EPG_DATABASE_WRITE"|"EPG_SOURCE_UNAVAILABLE";

export const EPG_FAILURE_CODES:ReadonlySet<string>=new Set<EpgFailureCode>([
 "EPG_HTTP_404","EPG_HTTP_403","EPG_HTTP_429","EPG_HTTP_5XX",
 "EPG_HTTP_REDIRECT","EPG_HTTP_ERROR","EPG_DNS_ERROR","EPG_TIMEOUT",
 "EPG_SIZE_LIMIT","EPG_XMLTV_INVALID","EPG_NO_PROGRAMMES",
 "EPG_DATABASE_WRITE","EPG_SOURCE_UNAVAILABLE",
]);

export function classifyEpgFailure(error:unknown,stage:"DOWNLOAD"|"DECODE"|"MAPPING"):EpgFailureCode{
 if(stage==="MAPPING")return "EPG_DATABASE_WRITE";
 const detail=error instanceof Error?error.message:"";
 if(stage==="DOWNLOAD"){
  const status=/^EPG source returned HTTP (\d{3})$/.exec(detail);
  if(status){
   const code=Number(status[1]);
   if(code===404)return "EPG_HTTP_404";
   if(code===403)return "EPG_HTTP_403";
   if(code===429)return "EPG_HTTP_429";
   if(code>=300&&code<400)return "EPG_HTTP_REDIRECT";
   if(code>=500&&code<600)return "EPG_HTTP_5XX";
   return "EPG_HTTP_ERROR";
  }
  if(/size limit|exceeds|payload too large|too large/i.test(detail))return "EPG_SIZE_LIMIT";
  if(/timed out|timeout|ETIMEDOUT/i.test(detail))return "EPG_TIMEOUT";
  if(/ENOTFOUND|EAI_AGAIN|source address is not exclusively public/i.test(detail))
   return "EPG_DNS_ERROR";
 }
 if(/No EPG emissions/.test(detail))return "EPG_NO_PROGRAMMES";
 if(stage==="DECODE")return /limit|size|large/i.test(detail)
  ?"EPG_SIZE_LIMIT":"EPG_XMLTV_INVALID";
 return "EPG_SOURCE_UNAVAILABLE";
}
