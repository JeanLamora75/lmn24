import { Client } from "pg";

/**
 * SCRUM-85 — exclusive PostgreSQL session lock.
 *
 * IMPORTANT: this is the low-level primitive, NOT the completed safety policy.
 * Every manual and automatic parser entry point must be adapted before use.
 * Callers must also abort the underlying work on loss of the connection;
 * otherwise Postgres may release the lock while that work is still running.
 */
export class GlobalParserBusyError extends Error {
  constructor() {
    super("Un autre parser est déjà en cours d'exécution.");
    this.name = "GlobalParserBusyError";
  }
}

export class GlobalParserLockLostError extends Error {
  constructor() {
    super("La connexion du verrou global a été perdue.");
    this.name = "GlobalParserLockLostError";
  }
}

const LOCK_NAMESPACE = 241024;
const LOCK_ID = 85;

export interface GlobalParserLease {
  readonly signal: AbortSignal;
  release(): Promise<void>;
}

export async function acquireGlobalParserLease(
  connectionString: string,
): Promise<GlobalParserLease> {
  if (!connectionString.trim()) throw new Error("DATABASE_URL requis pour le verrou global.");
  // Keep one dedicated PostgreSQL session open for the entire job. Never
  // acquire a session lock through Prisma's connection pool.
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  let closed = false;
  let lost = false;
  let acquired = false;
  const abort = new AbortController();
  const markLost = () => {
    if (closed || lost) return;
    lost = true;
    abort.abort(new GlobalParserLockLostError());
  };
  const onError = () => markLost();
  const onEnd = () => markLost();
  client.on("error", onError);
  client.on("end", onEnd);

  try {
    await client.connect();
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [LOCK_NAMESPACE, LOCK_ID],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) throw new GlobalParserBusyError();
  } catch (error) {
    closed = true;
    client.off("error", onError);
    client.off("end", onEnd);
    await client.end().catch(() => undefined);
    throw error;
  }

  return {
    signal: abort.signal,
    async release() {
      if (closed) return;
      closed = true;
      try {
        if (acquired && !lost) {
          await client.query("SELECT pg_advisory_unlock($1, $2)", [
            LOCK_NAMESPACE, LOCK_ID,
          ]);
        }
      } finally {
        // Ending the PostgreSQL session releases its lock even if unlocking
        // explicitly fails; no pooled session may retain an advisory lock.
        client.off("error", onError);
        client.off("end", onEnd);
        await client.end().catch(() => undefined);
      }
    },
  };
}
