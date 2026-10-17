import type { DatabaseClient } from "./client";
import type { Prisma } from "./generated/prisma/client";

/**
 * Runs one business write under the currently owned parser epoch.
 *
 * A previous owner must not commit after a successor rotates the epoch.
 * The shared transactional advisory lock lives until COMMIT; rotation takes
 * the exclusive counterpart first and therefore waits for in-flight writes.
 *
 * ownerToken may be absent ONLY for non-parser operations / legacy unit tests.
 */
export async function fencedParserWrite<T>(
  database: DatabaseClient,
  ownerToken: string | undefined,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!ownerToken) return operation(database as unknown as Prisma.TransactionClient);
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT assert_parser_write_epoch(${ownerToken}::uuid)`;
    return operation(tx);
  }, { maxWait: 10_000, timeout: 30_000 });
}
