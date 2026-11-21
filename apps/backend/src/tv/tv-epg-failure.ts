/** Stable, sanitized failure diagnostics. Never persist URLs, credentials,
 * response bodies or raw third-party error messages in the import history.
 */
export type EpgFailureCode =
 "EPG_HTTP_404"|"EPG_HTTP_403"|"EPG_HTTP_429"|"EPG_HTTP_5XX"|
 "EPG_HTTP_REDIRECT"|"EPG_HTTP_ERROR"|"EPG_DNS_ERROR"|
 "EPG_TIMEOUT"|"EPG_SIZE_LIMIT"|"EPG_XMLTV_INVALID"|
 "EPG_NO_PROGRAMMES"|"EPG_DATABASE_WRITE"|"EPG_SOURCE_UNAVAILABLE"|
 "EPG_TLS_ERROR"|"EPG_CONNECTION_ERROR"|"EPG_GZIP_INVALID"|
 "EPG_CONTENT_ENCODING_INVALID";

export const EPG_FAILURE_CODES:ReadonlySet<string>=new Set<EpgFailureCode>([
 "EPG_HTTP_404","EPG_HTTP_403","EPG_HTTP_429","EPG_HTTP_5XX",
 "EPG_HTTP_REDIRECT","EPG_HTTP_ERROR","EPG_DNS_ERROR","EPG_TIMEOUT",
 "EPG_SIZE_LIMIT","EPG_XMLTV_INVALID","EPG_NO_PROGRAMMES",
 "EPG_DATABASE_WRITE","EPG_SOURCE_UNAVAILABLE","EPG_TLS_ERROR",
 "EPG_CONNECTION_ERROR","EPG_GZIP_INVALID","EPG_CONTENT_ENCODING_INVALID",
]);

function details(error:unknown):{message:string;code:string}{
 if(!(error instanceof Error))return {message:"",code:""};
 const candidate=error as Error & {code?:unknown;cause?:unknown};
 const cause=candidate.cause && candidate.cause!==error
  ?details(candidate.cause):{message:"",code:""};
 return {
  message:[error.message,cause.message].join(" ").slice(0,4096),
  code:typeof candidate.code==="string"?candidate.code:cause.code,
 };
}
export function classifyEpgFailure(error:unknown,stage:"DOWNLOAD"|"DECODE"|"MAPPING"):EpgFailureCode{
 if(stage==="MAPPING")return "EPG_DATABASE_WRITE";
 const {message,code}=details(error);
 // The loader classifies transport/decode failures before they cross the
 // shared-source promise boundary. Never erase an already sanitized code.
 if(EPG_FAILURE_CODES.has(message.trim()))return message.trim() as EpgFailureCode;
 if(/No EPG emissions/.test(message))return "EPG_NO_PROGRAMMES";
 if(/size limit|exceeds|payload too large|too large|programme limit/i.test(message))
  return "EPG_SIZE_LIMIT";
 if(stage==="DECODE")return "EPG_XMLTV_INVALID";
 const status=/EPG source returned HTTP (\d{3})/.exec(message);
 if(status){
  const n=Number(status[1]);
  if(n===404)return "EPG_HTTP_404";
  if(n===403)return "EPG_HTTP_403";
  if(n===429)return "EPG_HTTP_429";
  if(n>=300&&n<400)return "EPG_HTTP_REDIRECT";
  if(n>=500&&n<600)return "EPG_HTTP_5XX";
  return "EPG_HTTP_ERROR";
 }
 if(/timed out|timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(message+" "+code))
  return "EPG_TIMEOUT";
 if(/ENOTFOUND|EAI_AGAIN|ENODATA|source address is not exclusively public|DNS/i.test(message+" "+code))
  return "EPG_DNS_ERROR";
 if(/Unexpected content encoding|ERR_HTTP_INVALID_HEADER_VALUE/i.test(message+" "+code))
  return "EPG_CONTENT_ENCODING_INVALID";
 if(/incorrect header check|invalid distance|invalid block type|unexpected end of file|Z_DATA_ERROR|Z_BUF_ERROR|Z_STREAM_ERROR|gzip/i.test(message+" "+code))
  return "EPG_GZIP_INVALID";
 if(/CERT_|ERR_TLS_|ERR_SSL_|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_HAS_EXPIRED|certificate|TLS handshake/i.test(message+" "+code))
  return "EPG_TLS_ERROR";
 if(/ECONNRESET|ECONNREFUSED|EPIPE|EHOSTUNREACH|ENETUNREACH|UND_ERR_SOCKET|socket hang up/i.test(message+" "+code))
  return "EPG_CONNECTION_ERROR";
 return "EPG_SOURCE_UNAVAILABLE";
}
