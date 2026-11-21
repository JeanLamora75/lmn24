/* Idempotent LMN24 local-only migration: activation no longer requires
 * a channel number. Refuses any non-local database connection.
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
 const source=path.resolve(__dirname,"../database/migrations/20261121_tv_channel_activation_optional_number.sql");
 const sql=fs.readFileSync(source,"utf8");
 if(!sql.includes("DROP CONSTRAINT IF EXISTS tv_channel_country_active_number"))
  throw new Error("Migration non reconnue.");
 const client=new Client({connectionString:raw,connectionTimeoutMillis:10000});
 await client.connect();
 try{
  const result=await client.query("SELECT to_regclass('public.tv_channel_country') AS table_name");
  if(!result.rows[0]?.table_name)throw new Error("Catalogue TV absent.");
  await client.query(sql);
  console.log("Activation des chaînes indépendante du numéro : migration locale appliquée.");
 }finally{await client.end();}
}
main().catch(error=>{
 console.error("Migration TV interrompue :",error instanceof Error?error.message:"erreur inconnue");
 process.exitCode=1;
});
