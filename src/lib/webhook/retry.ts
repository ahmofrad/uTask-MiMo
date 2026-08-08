import { prisma } from "@/lib/db";
import { enqueueWebhook } from "@/lib/queue";
import { logger } from "@/lib/logging";

function isEventPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function retryPendingWebhookEnqueues(limit = 100): Promise<number> {
  const now = new Date();
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      deliveredAt: null,
      nextRetryAt: { lte: now },
      error: { startsWith: "Webhook queue enqueue failed:" },
      webhook: { active: true, deletedAt: null },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: {
      id: true,
      webhookId: true,
      eventType: true,
      eventId: true,
      attemptNumber: true,
      requestPayload: true,
    },
  });

  let retried = 0;
  for (const delivery of deliveries) {
    if (!isEventPayload(delivery.requestPayload)) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { error: "Webhook queue retry skipped: invalid persisted payload", nextRetryAt: null },
      });
      continue;
    }

    try {
      await enqueueWebhook({
        webhookId: delivery.webhookId,
        eventType: delivery.eventType,
        eventId: delivery.eventId,
        payload: delivery.requestPayload,
        deliveryId: delivery.id,
      });
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { error: null, nextRetryAt: null },
      });
      retried += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown queue error";
      const nextRetryAt = new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** Math.max(0, delivery.attemptNumber - 1)));
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attemptNumber: { increment: 1 },
          error: `Webhook queue enqueue failed: ${message}`,
          nextRetryAt,
        },
      });
      logger.error({ deliveryId: delivery.id, error: message }, "Webhook enqueue retry failed");
    }
  }

  return retried;
}
