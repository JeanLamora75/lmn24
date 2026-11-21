/* Additive, idempotent source-geography migration for local LMN24 only.
 * Existing source configurations remain GLOBAL until explicitly edited.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {Client}=require("../packages/database/node_modules/pg");
async function main(){
 const raw=process.env.DATABASE_URL;
 if(!raw)throw new Error("DATABASE_URL absent : chargez le .env de LMN24");
 let url;
 try{url=new URL(raw);}catch{throw new Error("DATABASE_URL invalide");}
 const host=url.hostname.replace(/^\[|\]$/g,"").toLowerCase();
 const db=decodeURIComponent(url.pathname.replace(/^\//,""));
 if(!["localhost","127.0.0.1","::1"].includes(host)||db!=="lmn24"||
   !["postgres:","postgresql:"].includes(url.protocol))
   throw new Error("Migration réservée à la base locale lmn24.");
 const source=path.resolve(__dirname,"../database/migrations/20261121_tv_epg_source_scope.sql");
 const sql=fs.readFileSync(source,"utf8");
 if(!sql.includes("tv_source_geographic_scope_valid")||!sql.includes("COMMIT;"))
   throw new Error("SQL de migration non reconnu.");
 const client=new Client({connectionString:raw,connectionTimeoutMillis:10000});
 await client.connect();
 try{
  const check=await client.query("SELECT to_regclass('public.tv_source') AS tv_source");
  if(!check.rows[0]?.tv_source)throw new Error("Catalogue TV absent.");
  await client.query(sql);
  const result=await client.query(
   "SELECT geographic_scope,count(*)::int AS n FROM public.tv_source GROUP BY geographic_scope ORDER BY geographic_scope");
  console.log("Périmètre géographique EPG prêt. Configurez les sources nationales depuis LMN24.");
  console.table(result.rows);
 }finally{await client.end();}
}
main().catch(error=>{
 console.error("Migration TV interrompue :",error instanceof Error?error.message:"erreur inconnue");
 process.exitCode=1;
});
