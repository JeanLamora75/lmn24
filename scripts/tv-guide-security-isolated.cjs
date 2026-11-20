/* Isolated TV Guide security & abrupt parser-disconnect tests.
   Refuses any DB other than localhost/tv_guide_rehearsal. */
const assert=require("node:assert/strict");
const {Client}=require("../packages/database/node_modules/pg");
const raw=process.env.TV_REHEARSAL_DATABASE_URL||"";
const u=new URL(raw);
assert.equal(u.hostname,"127.0.0.1");
assert.equal(u.pathname,"/tv_guide_rehearsal");
const clients=[];
async function c(config={}) {const client=new Client({connectionString:raw,...config}); await client.connect();clients.push(client);return client}
async function err(fn,code) {let e;try{await fn()}catch(x){e=x}assert.ok(e,"expected rejection");if(code)assert.equal(e.code,code);return e}
const variant="a0000000-0000-4000-8000-000000000004";
const revision="a0000000-0000-4000-8000-000000000005";
const token="f0000000-0000-4000-8000-000000000005";
async function run(){
 const admin=await c(), owner=await c(), writer=await c(), newer=await c();
 // Simulate application roles without privileges on the TV publication pointer.
 await admin.query("CREATE ROLE tv_reader_ci LOGIN PASSWORD 'tv_reader_ci' NOSUPERUSER NOCREATEDB NOCREATEROLE");
 await admin.query("CREATE ROLE tv_writer_ci LOGIN PASSWORD 'tv_writer_ci' NOSUPERUSER NOCREATEDB NOCREATEROLE");
 await admin.query("REVOKE ALL ON public.tv_schedule_current FROM PUBLIC");
 await admin.query("REVOKE ALL ON public.parser_write_epoch FROM PUBLIC");
 await admin.query("GRANT USAGE ON SCHEMA public TO tv_reader_ci,tv_writer_ci");
 await admin.query("GRANT SELECT ON public.tv_schedule_current TO tv_reader_ci,tv_writer_ci");
 // Reader can't modify protected pointer or source credentials.
 const reader=await c({user:"tv_reader_ci",password:"tv_reader_ci"});
 await reader.query("SELECT count(*) FROM tv_schedule_current");
 await err(()=>reader.query("UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2",[revision,variant]),"42501");
 await err(()=>reader.query("SELECT * FROM tv_translation_provider"),"42501");
 const writerRole=await c({user:"tv_writer_ci",password:"tv_writer_ci"});
 await err(()=>writerRole.query("DELETE FROM tv_schedule_current"),"42501");
 await err(()=>writerRole.query("UPDATE parser_write_epoch SET owner_token=$1",[token]),"42501");
 console.log("PASS SEC1: least privilege prevents unauthorized pointer, epoch, provider reads");
 // Abrupt server-side connection termination releases the lease.
 const got=await owner.query("SELECT pg_try_advisory_lock(241024,85) AS yes");
 assert.equal(got.rows[0].yes,true);
 await owner.query("BEGIN");
 await owner.query("SELECT pg_advisory_xact_lock(241024,86)");
 const pid=(await owner.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
 await owner.query("INSERT INTO parser_write_epoch(singleton_id,owner_token,lock_backend_pid) VALUES(1,$1,$2) ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,lock_backend_pid=EXCLUDED.lock_backend_pid",[token,pid]);
 await owner.query("COMMIT");
 // A writer transaction starts with old token, then its holder is KILLED.
 // No write can be committed by this old token after takeover.
 const killed=await admin.query("SELECT pg_terminate_backend($1) AS killed",[pid]);
 assert.equal(killed.rows[0].killed,true);
 // Disconnect destroys session lock. Retry short bounded acquisition for release.
 let acquired=false;
 for(let i=0;i<20;i++){
   const res=await newer.query("SELECT pg_try_advisory_lock(241024,85) AS yes");
   if(res.rows[0].yes){acquired=true;break}
   await new Promise(r=>setTimeout(r,50));
 }
 assert.equal(acquired,true,"crashed parser lease should become available");
 const tokenNew="f0000000-0000-4000-8000-000000000006";
 await newer.query("BEGIN");
 await newer.query("SELECT pg_advisory_xact_lock(241024,86)");
 await newer.query("UPDATE parser_write_epoch SET owner_token=$1,lock_backend_pid=pg_backend_pid(),updated_at=now() WHERE singleton_id=1",[tokenNew]);
 await newer.query("COMMIT");
 await writer.query("BEGIN");
 await writer.query("SELECT set_config('app.tv_writer_owner',$1,true)",[token]);
 await err(()=>writer.query("UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2",[revision,variant]),"P0001");
 await writer.query("ROLLBACK");
 const now=(await admin.query("SELECT revision_id FROM tv_schedule_current WHERE variant_id=$1",[variant])).rows[0].revision_id;
 assert.equal(now,revision,"previously committed pointer must survive rejected stale write");
 console.log("PASS SEC2: terminated lease released, successor fencing prevents stale write");
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{for(const x of clients.reverse())await x.end().catch(()=>{})});
