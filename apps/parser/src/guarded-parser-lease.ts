import { acquireGlobalParserLease, type GlobalParserLease } from "./global-parser-lock.js";

/**
 * Fail closed if PostgreSQL drops the session holding the advisory lock.
 * The process must stop before a different instance is allowed to work.
 * In-flight operations cannot safely continue after the lease is lost.
 */
export async function acquireGuardedParserLease(): Promise<GlobalParserLease> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requise pour les parsers.");
  const lease = await acquireGlobalParserLease(url);
  lease.signal.addEventListener("abort", () => {
    process.stderr.write("LMN24 global parser lease lost: terminating parser process.\n");
    process.exit(1);
  }, { once: true });
  return lease;
}
