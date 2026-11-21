import {ServiceUnavailableException} from "@nestjs/common";
import {createVerifiedDbEpgLoader,networkEpgTransport,
  type AttestedCoverage,type EpgTransport} from "./tv-epg-loader";
import {processQueuedTvRun} from "./tv-import-worker";

/** Internal, explicit execution entry point. A queue request alone never starts
 * external network fetching; owner must approve source use, DB migration and
 * operational enablement separately. No external run is invoked by default.
 */
export function tvEpgExecutionApproved(env:Record<string,string|undefined>):boolean{
 return env.TV_CATALOG_ADMIN_ENABLED==="true"
   && env.TV_IMPORTS_ENABLED==="true"
   && env.TV_EPG_NETWORK_ENABLED==="true"
   && env.TV_MIGRATION_QUALIFIED==="true"
   && env.TV_EPG_SOURCE_USE_APPROVED==="true";
}
/** One-click explicit admin discovery is permitted ONLY for the local dev DB,
 * with the public site embargoed. This path cannot publish programme data.
 * Real production network ingestion retains all five operational gates.
 */
export function tvLocalDiscoveryApproved(env:Record<string,string|undefined>,
 connectionString:string):boolean{
 if(env.NODE_ENV!=="development"||env.TV_CATALOG_ADMIN_ENABLED!=="true"
   ||env.TV_IMPORTS_ENABLED!=="true"||env.TV_PUBLIC_ENABLED==="true"
   ||env.TV_PUBLIC_RELEASE_APPROVED==="true")return false;
 try{
  const db=new URL(connectionString);
  const host=db.hostname.toLowerCase().replaceAll("[","").replaceAll("]","");
  return ["postgres:","postgresql:"].includes(db.protocol)
   &&["localhost","127.0.0.1","::1"].includes(host)
   &&decodeURIComponent(db.pathname.startsWith("/")?db.pathname.slice(1):db.pathname)==="lmn24";
 }catch{return false;}
}

export async function runAuthorizedTvImport(args:{
 env:Record<string,string|undefined>;
 connectionString:string;runId:string;
 /** A source-independent, evidence-backed verifier, not an EPG feed claim. */
 attest:AttestedCoverage;
 /** Discovery mode writes only PENDING_REVIEW IDs; never programme/schedule rows. */
 discoveryOnly?:boolean;
 /** Fake transport used by Murat in offline tests. */
 transport?:EpgTransport;
}){
 if(!tvEpgExecutionApproved(args.env)
   &&!(args.discoveryOnly&&tvLocalDiscoveryApproved(args.env,args.connectionString))){
   throw new ServiceUnavailableException("TV EPG execution disabled until separately approved");
 }
 return processQueuedTvRun(args.connectionString,args.runId,(lease)=>
   createVerifiedDbEpgLoader(lease,args.runId,{
     transport:args.transport??networkEpgTransport,attest:args.attest,
     discoveryOnly:args.discoveryOnly??false,
   }));
}
