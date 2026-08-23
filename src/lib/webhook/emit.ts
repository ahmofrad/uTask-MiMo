import { enqueueWebhook } from "@/lib/queue";
import { randomUUID } from "@/lib/crypto";
import { logger } from "@/lib/logging";

export async function emitTaskEvent(
  eventType: string,
  taskId: string,
  data: Record<string, unknown>,
  actorId: string,
): Promise<{ queued: number; failedDeliveryIds: string[] }> {
  const event = {
    id: randomUUID(),
    type: eventType,
    createdAt: new Date().toISOString(),
    apiVersion: "2024-12-01",
    data,
    actor: { id: actorId, type: "user" },
  };

  // Find all active webhooks subscribed to this event type
  const { prisma } = await import("@/lib/db");
  const webhooks = await prisma.webhook.findMany({
    where: { active: true, deletedAt: null, events: { has: eventType } },
  });

  let queued = 0;
  const failedDeliveryIds: string[] = [];
  for (const wh of webhooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: wh.id,
        eventType,
        eventId: event.id,
        requestPayload: event as never,
        scheduledAt: new Date(),
      },
    });
    try {
      await enqueueWebhook({
        webhookId: wh.id,
        eventType,
        eventId: event.id,
        payload: event,
        deliveryId: delivery.id,
      });
      queued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue error";
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          error: `Webhook queue enqueue failed: ${message}`,
          nextRetryAt: new Date(Date.now() + 5_000),
        },
      });
      logger.error({ webhookId: wh.id, deliveryId: delivery.id, error: message }, "Webhook enqueue failed");
      failedDeliveryIds.push(delivery.id);
    }
  }

  return { queued, failedDeliveryIds };
}
