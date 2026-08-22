import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

/**
 * Default retention: 365 days. Enterprise audit logs are typically kept for
 * 1 year on-prem; configurable via `AUDIT_RETENTION_DAYS` env var.
 */
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Delete audit log rows older than the retention window.
 *
 * Runs as a daily BullMQ repeatable job. Deletes in batches of 5,000 to avoid
 * long-running transactions that could block the `AuditLog` table or exhaust
 * the PgBouncer connection pool.
 *
 * @returns number of rows deleted
 */
export async function compactAuditLog(): Promise<number> {
  const retentionDays = Number(process.env.AUDIT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;
  const BATCH_SIZE = 5_000;

  for (;;) {
    // deleteMany doesn't support `take`; use a CTE-limited raw delete so we
    // never hold a long transaction over the full AuditLog table.
    const result = await prisma.$executeRaw`
      DELETE FROM "AuditLog"
      WHERE "id" IN (
        SELECT "id" FROM "AuditLog"
        WHERE "occurredAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `;
    if (result === 0) break;
    totalDeleted += result;

    // If we deleted fewer than the batch size, we're done.
    if (result < BATCH_SIZE) break;
  }

  if (totalDeleted > 0) {
    logger.info(
      { totalDeleted, retentionDays, cutoff: cutoff.toISOString() },
      "Audit log compaction completed",
    );
  }

  return totalDeleted;
}
