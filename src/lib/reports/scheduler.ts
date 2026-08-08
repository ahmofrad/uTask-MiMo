import { refreshMaterializedViews } from "./refresh";
import { withDistributedLock } from "@/lib/queue/lock";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer: ReturnType<typeof setTimeout> | null = null;

export function startReportRefreshScheduler(): void {
  if (timer) return;
  const run = async () => {
    try {
      await withDistributedLock("materialized-view-refresh", 10 * 60_000, () => refreshMaterializedViews(true));
    } catch (err) {
      console.error("Report refresh failed:", err);
    }
    timer = setTimeout(run, REFRESH_INTERVAL_MS);
  };
  timer = setTimeout(run, 60_000); // First run after 60s
}

export function stopReportRefreshScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
