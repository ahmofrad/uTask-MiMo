import { logger } from "@/lib/logging";
import { withDistributedLock } from "@/lib/queue/lock";
import { pruneWebhookDeliveries } from "./retention";

let timer: ReturnType<typeof setTimeout> | null = null;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

async function tick(): Promise<void> {
  try {
    await withDistributedLock("webhook-delivery-retention", 30 * 60_000, async () => {
      await pruneWebhookDeliveries();
    });
  } catch (error) {
    logger.error({ error }, "Webhook delivery retention sweep failed");
  } finally {
    timer = setTimeout(() => void tick(), INTERVAL_MS);
  }
}

export function startWebhookRetentionScheduler(): void {
  if (!timer) timer = setTimeout(() => void tick(), 5 * 60_000);
}

export function stopWebhookRetentionScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
