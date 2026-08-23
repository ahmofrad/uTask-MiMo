/**
 * Standalone BullMQ worker process.
 * Run with: pnpm worker
 */
import { startWorkers, getWorkers } from "@/lib/queue";
import { startLdapSyncScheduler, stopLdapSyncScheduler } from "@/lib/auth/ldap-sync-scheduler";
import { startDueSoonScheduler, stopDueSoonScheduler } from "@/lib/notifications/due-soon-scheduler";
import { startDigestScheduler, stopDigestScheduler } from "@/lib/notifications/digest-scheduler";
import { startReportRefreshScheduler, stopReportRefreshScheduler } from "@/lib/reports/scheduler";
import { startWebhookRetryScheduler, stopWebhookRetryScheduler } from "@/lib/webhook/retry-scheduler";
import { startWebhookRetentionScheduler, stopWebhookRetentionScheduler } from "@/lib/webhook/retention-scheduler";
import { startAuditCompactionScheduler, stopAuditCompactionScheduler } from "@/lib/audit/compaction-scheduler";
import { logger } from "@/lib/logging";
import { unlinkSync, writeFileSync } from "node:fs";

const readyFile = process.env.WORKER_READY_FILE ?? "/tmp/taskapp-worker-ready";

function markReady(): void {
  writeFileSync(readyFile, `${process.pid}\n`, { mode: 0o600 });
}

function clearReady(): void {
  try {
    unlinkSync(readyFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ err }, "Unable to remove worker readiness marker");
    }
  }
}

async function start() {
  try {
    logger.info("Starting BullMQ workers...");
    await startWorkers();
    startLdapSyncScheduler();
    startDueSoonScheduler();
    startDigestScheduler();
    startReportRefreshScheduler();
    startWebhookRetryScheduler();
    startWebhookRetentionScheduler();
    startAuditCompactionScheduler();
    markReady();
    logger.info("Workers started");
  } catch (err) {
    clearReady();
    logger.error({ err }, "Worker startup failed");
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down workers");
  clearReady();
  stopLdapSyncScheduler();
  stopDueSoonScheduler();
  stopDigestScheduler();
  stopReportRefreshScheduler();
  stopWebhookRetryScheduler();
  stopWebhookRetentionScheduler();
  stopAuditCompactionScheduler();
  const { workers, queues } = getWorkers();
  const timeout = setTimeout(() => {
    logger.error("Shutdown timed out after 30s, forcing exit");
    process.exit(1);
  }, 30_000);

  try {
    await Promise.all([
      ...workers.map((w) => w.close()),
      ...queues.map((q) => q.close()),
    ]);
    logger.info("Workers shut down gracefully");
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
  }
  clearTimeout(timeout);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
