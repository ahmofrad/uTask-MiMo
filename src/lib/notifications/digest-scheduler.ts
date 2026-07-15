import { sendDailyDigests } from "./daily-digest";

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let timer: ReturnType<typeof setTimeout> | null = null;

export function startDigestScheduler(): void {
  if (timer) return;
  const scheduleNext = () => {
    timer = setTimeout(run, DIGEST_INTERVAL_MS);
  };
  const run = async () => {
    try {
      await sendDailyDigests();
    } catch (err) {
      console.error("Daily digest failed:", err);
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
