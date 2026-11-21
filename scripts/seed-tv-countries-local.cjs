/* Local-only Guide TV country seed runner. No psql or extra dependency.
 * The SQL itself stays versioned in database/seed_tv_countries_249.sql.
 * Refuses all non-local connections and database names other than lmn24.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {Client}=require("../packages/database/node_modules/pg");

async function main(){
  const raw=process.env.DATABASE_URL;
  if(!raw)throw new Error("DATABASE_URL absent. Lancez : node --env-file=.env scripts/seed-tv-countries-local.cjs");
  let url;
  try{url=new URL(raw);}catch{throw new Error("DATABASE_URL invalide");}
  const host=url.hostname.replace(/^\[|\]$/g,"").toLowerCase();
  const dbName=decodeURIComponent(url.pathname.replace(/^\//,""));
  if(!["localhost","127.0.0.1","::1"].includes(host)||dbName!=="lmn24"){
    throw new Error("REFUS : ce script est réservé à la base locale lmn24 sur localhost.");
  }
  if(url.protocol!=="postgresql:"&&url.protocol!=="postgres:"){
    throw new Error("REFUS : DATABASE_URL doit être postgresql:// ou postgres://");
  }
  const file=path.resolve(__dirname,"../database/seed_tv_countries_249.sql");
  const sql=fs.readFileSync(file,"utf8");
  if(!sql.includes("ON CONFLICT (country_id) DO NOTHING")||!sql.includes("COMMIT;")){
    throw new Error("REFUS : le script SQL attendu n'a pas été trouvé ou vérifié");
  }
  const client=new Client({connectionString:raw,connectionTimeoutMillis:10000});
  await client.connect();
  try{
    // The versioned SQL contains its own BEGIN/COMMIT and preflight checks.
    // The final SELECT returns a read-only summary; pg supports multi-statement queries.
    const output=await client.query(sql);
    const results=Array.isArray(output)?output:[output];
    const last=results.at(-1);
    console.log("Guide TV : chargement terminé.");
    if(last?.rows?.length)console.table(last.rows);
  }finally{await client.end();}
}
main().catch(error=>{
  // Never dump DB URLs/passwords or full stack traces.
  console.error("Chargement pays TV échoué :",error instanceof Error?error.message:"Erreur inconnue");
  process.exitCode=1;
});
