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
 if(!tvEpgExecutionApproved(args.env)){
   throw new ServiceUnavailableException("TV EPG execution disabled until separately approved");
 }
 return processQueuedTvRun(args.connectionString,args.runId,(lease)=>
   createVerifiedDbEpgLoader(lease,args.runId,{
     transport:args.transport??networkEpgTransport,attest:args.attest,
     discoveryOnly:args.discoveryOnly??false,
   }));
}
