import { acquireGuardedParserLease } from "./guarded-parser-lease.js";
import { Client } from "pg";

async function run() {
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("DATABASE_URL required");
  const lease=await acquireGuardedParserLease();
  const client=new Client({connectionString:url});
  await client.connect();
  // Enumerate the dedicated advisory-lock session (not this observer).
  const result=await client.query<{pid:number}>(`
    SELECT pid FROM pg_locks
    WHERE locktype='advisory' AND granted=true
      AND classid=241024 AND objid=85
      AND pid<>pg_backend_pid()
  `);
  const pid=result.rows[0]?.pid;
  if(!pid)throw new Error("Global advisory lock holder missing");
  process.stdout.write("LEASE_HELD:"+pid+"\\n");
  await client.end();
  // The loss handler must exit the process before this delayed write marker.
  // A non-terminating process constitutes a failing safety test.
  await new Promise(resolve=>setTimeout(resolve,20_000));
  process.stdout.write("UNSAFE_CONTINUATION\\n");
  await lease.release();
}
run().catch(error=>{console.error(error);process.exitCode=2});
