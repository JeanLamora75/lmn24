/* Apply the two additive TV Guide read indexes to a LOCAL LMN24 DB.
 * No psql installation required. CREATE INDEX CONCURRENTLY is deliberately
 * executed statement-by-statement outside of a transaction.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {Client}=require("../packages/database/node_modules/pg");

async function main(){
 const raw=process.env.DATABASE_URL;
 if(!raw)throw new Error("DATABASE_URL absent : vérifiez le fichier .env à la racine.");
 let url;
 try{url=new URL(raw);}catch{throw new Error("DATABASE_URL invalide.");}
 const host=url.hostname.replace(/^\\[|\\]$/g,"").toLowerCase();
 const database=decodeURIComponent(url.pathname.replace(/^\\/,""));
 if(!["localhost","127.0.0.1","::1"].includes(host)
   ||database!=="lmn24"
   ||!["postgres:","postgresql:"].includes(url.protocol))
  throw new Error("Optimisation autorisée uniquement sur la base locale lmn24.");

 const filename=path.resolve(__dirname,"../database/migrations/20261122_tv_schedule_performance_indexes.sql");
 const sql=fs.readFileSync(filename,"utf8");
 const statements=sql.split(/;/).map(x=>x.replace(/^\\s*(?:--[^\\n]*\\n\\s*)*/gm,"").trim()).filter(Boolean);
 if(statements.length!==2 || statements.some(x=>!/^CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tv_(revision_latest_visible|airing_revision_interval)\\s+ON public\\.tv_(schedule_revision|airing)\\s*\\(/i.test(x)))
  throw new Error("Fichier SQL d'optimisation TV non reconnu.");

 const client=new Client({connectionString:raw,connectionTimeoutMillis:10000});
 await client.connect();
 try{
  const check=await client.query(`SELECT
    to_regclass('public.tv_schedule_revision') IS NOT NULL AS revision,
    to_regclass('public.tv_airing') IS NOT NULL AS airing`);
  if(!check.rows[0]?.revision||!check.rows[0]?.airing)
   throw new Error("Les tables Guide TV n'existent pas encore dans cette base.");
  for(let i=0;i<statements.length;i++){
   console.log(`Création/vérification index TV ${i+1}/${statements.length}...`);
   await client.query(statements[i]);
  }
  const result=await client.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname=ANY($1::text[])
    ORDER BY indexname`,[["idx_tv_revision_latest_visible","idx_tv_airing_revision_interval"]]);
  if(result.rows.length!==2)throw new Error("La vérification des deux index a échoué.");
  console.log("Optimisation TV locale terminée : 2 index présents.");
  console.table(result.rows);
 }finally{await client.end();}
}
main().catch(error=>{
 console.error("Optimisation TV interrompue :",error instanceof Error?error.message:"erreur inconnue");
 process.exitCode=1;
});
