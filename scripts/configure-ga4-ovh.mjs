#!/usr/bin/env node
// One-time installation of GA4 service account into the OVH runtime .env.
// Read the full Google service-account JSON from stdin, never command arguments
// or GitHub-printed logs; do not write the raw credential JSON to disk.
import { createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, chmodSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const envFile = "/home/ubuntu/lmn24/.env";
const property = "391719478";
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk.toString();
  if (raw.length > 100_000) throw new Error("Credential input exceeds allowed size");
}
if (!raw.trim()) throw new Error("Missing GA4 service account credentials");
let credential;
try { credential = JSON.parse(raw); }
catch { throw new Error("Invalid JSON credential file"); }
if (credential?.type !== "service_account" ||
    !String(credential.client_email || "").endsWith(".gserviceaccount.com") ||
    typeof credential.private_key !== "string") {
  throw new Error("Invalid service account credential type");
}
createPrivateKey(credential.private_key); // Validate key material before touching .env
const current = readFileSync(envFile, "utf8");
const filtered = current.split(/\r?\n/).filter(line => !/^GA4_(?:PROPERTY_ID|SERVICE_ACCOUNT_JSON_B64)=/.test(line)).join("\n").trimEnd();
const encoded = Buffer.from(raw, "utf8").toString("base64");
const newContent = filtered + "\nGA4_PROPERTY_ID=" + property +
  "\nGA4_SERVICE_ACCOUNT_JSON_B64=" + encoded + "\n";
const temporaryFile = envFile + ".ga4-" + randomUUID();
try {
  writeFileSync(temporaryFile, newContent, { mode: 0o600, flag: "wx" });
  chmodSync(temporaryFile, 0o600);
  renameSync(temporaryFile, envFile);
  const restart = spawnSync("sudo", ["-n", "/usr/bin/systemctl", "restart", "lmn24-frontend.service"], {stdio:"inherit"});
  if (restart.status !== 0) {
    const rollbackFile = envFile + ".rollback-" + randomUUID();
    writeFileSync(rollbackFile, current, { mode: 0o600, flag: "wx" });
    renameSync(rollbackFile, envFile);
    spawnSync("sudo", ["-n", "/usr/bin/systemctl", "restart", "lmn24-frontend.service"], {stdio:"inherit"});
    throw new Error("Frontend restart failed; previous environment restored");
  }
  console.log("GA4 service account installed in OVH runtime .env; frontend restarted.");
} finally {
  try { unlinkSync(temporaryFile); } catch { /* already renamed */ }
}
