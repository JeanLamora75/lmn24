/* LMN24 Guide TV — import local de 10 sources EPG candidates, sans psql.
 * No network requests to providers; no automatic source activation.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {Client}=require("../packages/database/node_modules/pg");
async function run(){
 const value=process.env.DATABASE_URL;
 if(!value)throw Error("DATABASE_URL absent (attendu dans .env)");
 let url;
 try{url=new URL(value)}catch{throw Error("DATABASE_URL invalide")}
 const hostname=url.hostname.replace(/^\[|\]$/g,"").toLowerCase();
 const database=decodeURIComponent(url.pathname.replace(/^\//,""));
 if(!["localhost","127.0.0.1","::1"].includes(hostname)||database!=="lmn24"){
  throw Error("REFUS : commande réservée à la base locale lmn24 sur localhost");
 }
 if(!["postgres:","postgresql:"].includes(url.protocol))throw Error("Protocole PostgreSQL requis");
 const sqlPath=path.resolve(__dirname,"../database/seed_tv_epg_sources_candidates.sql");
 const sql=fs.readFileSync(sqlPath,"utf8");
 if(!sql.includes("FROM _lmn24_epg_source_candidates")||!sql.includes("COMMIT;")){
  throw Error("Fichier SQL EPG manquant ou inattendu");
 }
 const client=new Client({connectionString:value,connectionTimeoutMillis:10000});
 await client.connect();
 try{
  const response=await client.query(sql);
  const last=Array.isArray(response)?response.at(-1):response;
  console.log("Guide TV : candidats EPG enregistrés (sans activation ni approbation des droits).");
  if(last?.rows?.length)console.table(last.rows);
 }finally{await client.end()}
}
run().catch(error=>{
 console.error("Import EPG interrompu :",error instanceof Error?error.message:"erreur inconnue");
 process.exitCode=1;
});
