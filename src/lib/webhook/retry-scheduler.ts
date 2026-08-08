import { logger } from "@/lib/logging";
import { withDistributedLock } from "@/lib/queue/lock";
import { retryPendingWebhookEnqueues } from "./retry";

let timer: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
  try {
    await withDistributedLock("webhook-enqueue-retry", 10 * 60_000, async () => {
      const retried = await retryPendingWebhookEnqueues();
      if (retried > 0) logger.info({ retried }, "Retried webhook enqueue failures");
    });
  } catch (err) {
    logger.error({ err }, "Webhook enqueue retry sweep failed");
  } finally {
    timer = setTimeout(() => void tick(), 60_000);
  }
}

export function startWebhookRetryScheduler(): void {
  if (!timer) timer = setTimeout(() => void tick(), 60_000);
}

export function stopWebhookRetryScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
