import { sendDailyDigests } from "./daily-digest";
import { withDistributedLock } from "@/lib/queue/lock";
import { logger } from "@/lib/logging";

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let timer: ReturnType<typeof setTimeout> | null = null;

export function startDigestScheduler(): void {
  if (timer) return;
  const scheduleNext = () => {
    timer = setTimeout(run, DIGEST_INTERVAL_MS);
  };
  const run = async () => {
    try {
      await withDistributedLock("daily-digest", 2 * 3_600_000, sendDailyDigests);
    } catch (err) {
      logger.error({ err }, "Daily digest failed");
    }
    scheduleNext();
  };
  // First run after 60s to let the app initialize
  timer = setTimeout(run, 60_000);
}

export function stopDigestScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
