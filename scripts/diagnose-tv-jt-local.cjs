/* Diagnostic en lecture seule : JT de TF1 du 22/11/2026.
 * Utilisation depuis la racine du dépôt :
 *   node --env-file=.env scripts/diagnose-tv-jt-local.cjs
 * Aucune migration, modification ou nouvel import.
 */
"use strict";
const {Client}=require("../packages/database/node_modules/pg");

async function main(){
 const databaseUrl=process.env.DATABASE_URL;
 if(!databaseUrl)throw new Error("DATABASE_URL absente du fichier .env");
 const u=new URL(databaseUrl);
 const hostname=u.hostname.replace(/^\[|\]$/g,"").toLowerCase();
 if(!["localhost","127.0.0.1","::1"].includes(hostname)||
    !["postgres:","postgresql:"].includes(u.protocol)){
  throw new Error("Diagnostic réservé à PostgreSQL local. Aucune connexion distante.");
 }
 const client=new Client({connectionString:databaseUrl,connectionTimeoutMillis:10000});
 await client.connect();
 try{
  await client.query("BEGIN READ ONLY");
  const result=await client.query(`
    SELECT
      ch.name AS "Chaîne",
      p.title AS "Programme",
      s.name AS "Source EPG",
      COALESCE(sc.priority::text,'globale / non classée') AS "Priorité",
      r.status AS "Grille",
      a.id AS "Diffusion",
      r.id AS "Révision",
      to_char(r.created_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI:SS') AS "Créée Paris",
      r.variant_id AS "Variante",
      to_char(a.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS "Début UTC",
      to_char(a.starts_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI') AS "Début Paris",
      to_char(a.ends_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI') AS "Fin Paris"
    FROM public.tv_airing a
    JOIN public.tv_programme p ON p.id=a.programme_id
    JOIN public.tv_schedule_revision r ON r.id=a.revision_id
    JOIN public.tv_source s ON s.id=a.source_id
    JOIN public.tv_variant_country vc ON vc.variant_id=r.variant_id
    JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
    JOIN public.tv_channel ch ON ch.id=cc.channel_id
    JOIN public.country c ON c.id=cc.country_id
    LEFT JOIN public.tv_source_country sc ON sc.source_id=s.id
       AND sc.country_id=cc.country_id
    WHERE trim(c.iso_code2)='FR'
      AND lower(trim(ch.name))='tf1'
      AND (p.title ILIKE '%JT 20h%' OR p.title ILIKE '%JT 20 h%')
      AND (a.starts_at AT TIME ZONE 'Europe/Paris')::date=DATE '2026-11-22'
      AND r.status IN ('STAGING','PUBLISHED')
    ORDER BY a.starts_at,s.name,r.created_at DESC
    LIMIT 30
  `);
  if(!result.rows.length){
   console.log("Aucun JT 20h de TF1 trouvé en base le 22/11/2026.");
  }else{
   console.log("1. Toutes les révisions enregistrées — TF1 / JT 20h / 22 novembre 2026");
   console.table(result.rows);
   console.log("\n2. Révision que le Guide TV public doit utiliser (la plus récente par variante et journée)");
   const current=await client.query(`
    SELECT a.id AS "Diffusion",r.id AS "Révision",r.variant_id AS "Variante",
      to_char(r.created_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI:SS') AS "Créée Paris",
      r.status AS "Grille",s.name AS "Source EPG",p.title AS "Programme",
      to_char(a.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS "Début UTC",
      to_char(a.starts_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI') AS "Début Paris"
    FROM public.tv_airing a
    JOIN public.tv_schedule_revision r ON r.id=a.revision_id
    JOIN public.tv_programme p ON p.id=a.programme_id
    JOIN public.tv_source s ON s.id=a.source_id
    JOIN public.tv_variant_country vc ON vc.variant_id=r.variant_id
    JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
    JOIN public.tv_channel ch ON ch.id=cc.channel_id
    JOIN public.country c ON c.id=cc.country_id
    WHERE trim(c.iso_code2)='FR' AND lower(trim(ch.name))='tf1'
      AND (p.title ILIKE '%JT 20h%' OR p.title ILIKE '%JT 20 h%')
      AND (a.starts_at AT TIME ZONE 'Europe/Paris')::date=DATE '2026-11-22'
      AND r.status IN ('STAGING','PUBLISHED')
      AND NOT EXISTS(
        SELECT 1 FROM public.tv_schedule_revision newer
        WHERE newer.variant_id=r.variant_id AND newer.local_date=r.local_date
          AND newer.status IN ('STAGING','PUBLISHED')
          AND (newer.created_at,newer.id)>(r.created_at,r.id)
      )
    ORDER BY r.created_at DESC,a.starts_at
    LIMIT 30
   `);
   if(current.rows.length)console.table(current.rows);
   else console.log("Aucun JT 20h dans la dernière grille : les anciennes révisions ne sont plus utilisées.");
  }
  await client.query("ROLLBACK");
  console.log("\n3. Réponse de l'API publique LMN24 (TF1 / JT 20h)");
  const endpoint=new URL("/api/public/tv/search","http://127.0.0.1:3000");
  endpoint.searchParams.set("q","JT 20h");
  endpoint.searchParams.set("channelsPage","1");
  endpoint.searchParams.set("programmesPage","1");
  endpoint.searchParams.set("pageSize","50");
  endpoint.searchParams.set("section","programmes");
  try{
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(8000),
    headers:{accept:"application/json"},redirect:"manual"});
   console.log("HTTP",response.status);
   if(response.status>=300&&response.status<400){
    console.log("Redirection inattendue :",response.headers.get("location"));
   }else if(!response.ok){
    console.log((await response.text()).slice(0,500));
   }else{
    const payload=await response.json();
    const rows=(payload.programmes?.items??[])
     .filter(p=>p.countryIso2==="FR"&&p.channelName?.trim().toLowerCase()==="tf1")
     .filter(p=>p.title?.toLowerCase().includes("jt 20"))
     .filter(p=>p.startsAt?.startsWith("2026-11-22"));
    console.table(rows.map(p=>({
     "Diffusion":p.id,"Programme":p.title,"Début API (UTC)":p.startsAt,
     "Début Paris":new Intl.DateTimeFormat("fr-FR",{
      timeZone:"Europe/Paris",day:"2-digit",month:"2-digit",year:"numeric",
      hour:"2-digit",minute:"2-digit",hourCycle:"h23",
     }).format(new Date(p.startsAt)),"Variante":p.variantId,
    })));
    if(!rows.length)console.log("Aucun JT 20h TF1 dans la réponse API (période de recherche ou filtre).");
    if(rows.length){
     // Resolve exact API airing identities; comparing names alone can mix
     // distinct airings or revisions of the same named programme.
     await client.query("BEGIN READ ONLY");
     try{
      const detail=await client.query(`
       SELECT a.id AS "Diffusion",r.id AS "Révision",r.status AS "Grille",
         s.name AS "Source EPG",p.title AS "Programme",
         r.variant_id AS "Variante",
         to_char(a.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS "Début UTC",
         to_char(a.starts_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI') AS "Début Paris",
         to_char(r.created_at AT TIME ZONE 'Europe/Paris','YYYY-MM-DD HH24:MI:SS') AS "Créée Paris"
       FROM public.tv_airing a
       JOIN public.tv_schedule_revision r ON r.id=a.revision_id
       JOIN public.tv_programme p ON p.id=a.programme_id
       JOIN public.tv_source s ON s.id=a.source_id
       WHERE a.id = ANY($1::uuid[])
       ORDER BY a.starts_at,r.created_at DESC
      `,[rows.map(p=>p.id)]);
      console.log("\n4. Identifiants exacts des diffusions de l'API retrouvés en base");
      console.table(detail.rows);
     }finally{await client.query("ROLLBACK");}
    }
   }
  }catch(error){console.log("API non accessible :",error.message,
    "— vérifiez que frontend et backend sont démarrés.");}
 }catch(error){
  await client.query("ROLLBACK").catch(()=>undefined);
  throw error;
 }finally{await client.end();}
}
main().catch(e=>{console.error("Diagnostic impossible :",e.message);process.exitCode=1;});
