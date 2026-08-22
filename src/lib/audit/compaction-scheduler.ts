import { logger } from "@/lib/logging";
import { withDistributedLock } from "@/lib/queue/lock";
import { compactAuditLog } from "./compaction";

let timer: ReturnType<typeof setTimeout> | null = null;

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function tick(): Promise<void> {
  try {
    await withDistributedLock("audit-compaction", 30 * 60_000, async () => {
      await compactAuditLog();
    });
  } catch (err) {
    logger.error({ err }, "Audit log compaction sweep failed");
  } finally {
    timer = setTimeout(() => void tick(), INTERVAL_MS);
  }
}

export function startAuditCompactionScheduler(): void {
  if (!timer) timer = setTimeout(() => void tick(), 5 * 60_000); // first run after 5 min
}

export function stopAuditCompactionScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
