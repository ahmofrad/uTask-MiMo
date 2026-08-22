import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

const MATERIALIZED_VIEWS = [
  "mv_project_task_stats",
  "mv_user_task_stats",
  "mv_org_stats",
] as const;

/**
 * Views that must be refreshed NON-concurrently.
 *
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a UNIQUE index that uses
 * ONLY plain column references (no expressions, no WHERE clause). `mv_org_stats`
 * is a single-row aggregate with no natural unique column, so its unique index
 * is an expression `((1))` — which Postgres rejects for CONCURRENTLY. Refreshing
 * it non-concurrently is safe: it acquires a brief AccessExclusiveLock on a
 * single-row view, which is effectively instantaneous.
 */
const NON_CONCURRENT_VIEWS = new Set(["mv_org_stats"]);

/**
 * Prisma error code for an undefined table / relation.
 * Used to detect materialized views that are tracked in code but missing
 * from the database (e.g. a migration marked applied without running).
 */
const UNDEFINED_RELATION = "42P01";

/** Views known to be missing this run, so we stop retrying them. */
const missingViews = new Set<string>();

export async function refreshMaterializedViews(concurrently = false): Promise<void> {
  for (const view of MATERIALIZED_VIEWS) {
    if (missingViews.has(view)) continue;
    try {
      const useConcurrent = concurrently && !NON_CONCURRENT_VIEWS.has(view);
      const sql = useConcurrent
        ? `REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`
        : `REFRESH MATERIALIZED VIEW "${view}"`;
      await prisma.$executeRawUnsafe(sql);
      logger.info({ view }, "Materialized view refreshed");
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.meta?.code === UNDEFINED_RELATION
      ) {
        // The view doesn't exist in the DB — a migration is marked applied
        // without having created it. Warn once and skip to avoid error-spam
        // every refresh tick.
        missingViews.add(view);
        logger.warn(
          { view, migration: "20260714093154_materialized_views" },
          "Materialized view missing from DB; skipping refresh. Run prisma migrate deploy or re-create via the corrective migration.",
        );
        continue;
      }
      logger.error({ err, view }, "Failed to refresh materialized view");
    }
  }
}

/** Test-only: reset the missing-view skip set so a fresh run is simulated. */
export function _resetMissingViewsForTest(): void {
  missingViews.clear();
}
