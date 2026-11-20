/* LMN24 Guide TV — disposable PostgreSQL concurrency rehearsal.
 * ONLY run against a dedicated tv_guide_rehearsal database provisioned by
 * .github/workflows/tv-guide-isolated-validation.yml.
 * This script refuses other database names to avoid modifying real LMN24.
 */
const assert = require("node:assert/strict");
const { Client } = require("../packages/database/node_modules/pg");

const url = new URL(process.env.TV_REHEARSAL_DATABASE_URL || "");
assert.equal(url.pathname, "/tv_guide_rehearsal", "REFUSED: only isolated rehearsal DB");
assert.equal(url.hostname, "127.0.0.1", "REFUSED: rehearsal hostname must be localhost");
const connectionString = url.href;
const UUID = {
  country: "a0000000-0000-4000-8000-000000000001",
  channel: "a0000000-0000-4000-8000-000000000002",
  association: "a0000000-0000-4000-8000-000000000003",
  variant: "a0000000-0000-4000-8000-000000000004",
  rev1: "a0000000-0000-4000-8000-000000000005",
  rev2: "a0000000-0000-4000-8000-000000000006",
  ownerA: "a0000000-0000-4000-8000-000000000007",
  ownerB: "a0000000-0000-4000-8000-000000000008",
};
const clients = [];
async function connect() {
  const c = new Client({ connectionString });
  await c.connect();
  clients.push(c);
  return c;
}
async function tx(client, token, work) {
  await client.query("BEGIN");
  try {
    if (token) await client.query("SELECT set_config('app.tv_writer_owner',$1,true)", [token]);
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
async function acquireLease(client, token) {
  const res = await client.query("SELECT pg_try_advisory_lock(241024,85) AS ok");
  assert.equal(res.rows[0].ok, true, "expected exclusive session lease");
  await tx(client, null, async () => {
    await client.query("SELECT pg_advisory_xact_lock(241024,86)");
    await client.query(
      "INSERT INTO parser_write_epoch(singleton_id,owner_token,lock_backend_pid) " +
      "VALUES(1,$1,pg_backend_pid()) ON CONFLICT(singleton_id) DO UPDATE " +
      "SET owner_token=EXCLUDED.owner_token,lock_backend_pid=EXCLUDED.lock_backend_pid",
      [token],
    );
  });
}
async function expectFailure(run, code) {
  let failed = false;
  try { await run(); }
  catch (e) { failed = true; if (code) assert.equal(e.code, code); }
  assert.equal(failed, true, "operation unexpectedly succeeded");
}
async function main() {
  const owner = await connect();
  const writer1 = await connect();
  const writer2 = await connect();
  const successor = await connect();
  // Full LMN24 bootstrap fixture (country has mandatory ISO codes).
  await owner.query("INSERT INTO country(id,iso_code2,iso_code3,slug) VALUES($1,'FR','FRA','tv-test-country')", [UUID.country]);
  await owner.query("INSERT INTO tv_country(country_id,reference_timezone,is_active) VALUES($1,'Europe/Paris',true)", [UUID.country]);
  await owner.query("INSERT INTO tv_channel(id,slug,name) VALUES($1,'tv-test-channel','TV test')", [UUID.channel]);
  await owner.query("INSERT INTO tv_channel_country(id,channel_id,country_id,is_active,manual_number) VALUES($1,$2,$3,true,7)",
    [UUID.association,UUID.channel,UUID.country]);
  await owner.query("INSERT INTO tv_channel_variant(id,channel_id,code,name,timezone,is_default) VALUES($1,$2,'main','Paris','Europe/Paris',true)",
    [UUID.variant, UUID.channel]);
  await owner.query("INSERT INTO tv_schedule_revision(id,variant_id,local_date,status,published_at) VALUES " +
    "($1,$3,'2026-11-20','PUBLISHED',now()),($2,$3,'2026-11-20','PUBLISHED',now())",
    [UUID.rev1,UUID.rev2,UUID.variant]);

  await acquireLease(owner, UUID.ownerA);

  // A concurrent owner cannot seize the same global lease.
  const occupied = await successor.query("SELECT pg_try_advisory_lock(241024,85) AS ok");
  assert.equal(occupied.rows[0].ok, false, "another worker obtained live lease");
  console.log("PASS C1: concurrent second owner rejected");

  await tx(writer1, UUID.ownerA, () => writer1.query(
    "INSERT INTO tv_schedule_current(variant_id,local_date,revision_id) VALUES($1,'2026-11-20',$2)",
    [UUID.variant,UUID.rev1],
  ));
  console.log("PASS C2: authenticated owner can publish initial pointer");

  // Both writers are separate live sessions. The compare-and-swap WHERE
  // predicate prevents the second from clobbering a newer revision.
  await writer1.query("BEGIN");
  await writer1.query("SELECT set_config('app.tv_writer_owner',$1,true)", [UUID.ownerA]);
  const first = await writer1.query(
    "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2 AND local_date='2026-11-20' AND revision_id=$3",
    [UUID.rev2,UUID.variant,UUID.rev1],
  );
  assert.equal(first.rowCount, 1);

  let secondStarted;
  const started = new Promise(r => { secondStarted=r; });
  const competing = (async () => {
    await writer2.query("BEGIN");
    await writer2.query("SELECT set_config('app.tv_writer_owner',$1,true)", [UUID.ownerA]);
    secondStarted();
    const result = await writer2.query(
      "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2 AND local_date='2026-11-20' AND revision_id=$3",
      [UUID.rev1,UUID.variant,UUID.rev1],
    );
    await writer2.query("COMMIT");
    return result.rowCount;
  })().catch(async e => { await writer2.query("ROLLBACK").catch(()=>{}); throw e; });
  await started;
  await new Promise(r => setTimeout(r, 100));
  await writer1.query("COMMIT");
  assert.equal(await competing, 0, "stale competing update clobbered current pointer");
  console.log("PASS C3: two sessions serialize and stale CAS writer updates zero rows");

  await expectFailure(() => tx(writer1, UUID.ownerB, () => writer1.query(
    "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2",
    [UUID.rev1,UUID.variant],
  )), "P0001");
  await expectFailure(() => tx(writer1, null, () => writer1.query(
    "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2",
    [UUID.rev1,UUID.variant],
  )), "42501");
  console.log("PASS C4: wrong and missing owner tokens refused");

  // Handover of lease: old token becomes invalid even though it was valid.
  const release = await owner.query("SELECT pg_advisory_unlock(241024,85) AS ok");
  assert.equal(release.rows[0].ok,true);
  await acquireLease(successor,UUID.ownerB);
  await expectFailure(() => tx(writer1, UUID.ownerA, () => writer1.query(
    "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2",
    [UUID.rev1,UUID.variant],
  )), "P0001");
  await tx(writer2, UUID.ownerB, () => writer2.query(
    "UPDATE tv_schedule_current SET revision_id=$1 WHERE variant_id=$2 AND revision_id=$3",
    [UUID.rev1,UUID.variant,UUID.rev2],
  ));
  const end = await owner.query("SELECT revision_id FROM tv_schedule_current WHERE variant_id=$1",[UUID.variant]);
  assert.equal(end.rows[0].revision_id,UUID.rev1);
  console.log("PASS C5: successor accepted; predecessor fenced out; pointer intact");
  console.log("TV CONCURRENCY PASS: five cross-session assertions");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  for(const c of clients.reverse()) await c.end().catch(()=>{});
});
