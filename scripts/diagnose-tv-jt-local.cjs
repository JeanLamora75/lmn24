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
   console.log("Horaires réellement enregistrés — TF1 / JT 20h / 22 novembre 2026 :");
   console.table(result.rows);
  }
  await client.query("ROLLBACK");
 }catch(error){
  await client.query("ROLLBACK").catch(()=>undefined);
  throw error;
 }finally{await client.end();}
}
main().catch(e=>{console.error("Diagnostic impossible :",e.message);process.exitCode=1;});
