import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

const MATERIALIZED_VIEWS = [
  "mv_project_task_stats",
  "mv_user_task_stats",
  "mv_org_stats",
] as const;

export async function refreshMaterializedViews(concurrently = false): Promise<void> {
  for (const view of MATERIALIZED_VIEWS) {
    try {
      const sql = concurrently
        ? `REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`
        : `REFRESH MATERIALIZED VIEW "${view}"`;
      await prisma.$executeRawUnsafe(sql);
      logger.info({ view }, "Materialized view refreshed");
    } catch (err) {
      logger.error({ err, view }, "Failed to refresh materialized view");
    }
  }
}
