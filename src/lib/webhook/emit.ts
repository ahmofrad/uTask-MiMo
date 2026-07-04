import { enqueueWebhook } from "@/lib/queue";
import crypto from "crypto";

export async function emitTaskEvent(
  eventType: string,
  taskId: string,
  data: Record<string, unknown>,
  actorId: string,
) {
  const event = {
    id: `evt_${crypto.randomUUID()}`,
    type: eventType,
    createdAt: new Date().toISOString(),
    apiVersion: "2024-12-01",
    data,
    actor: { id: actorId, type: "user" },
  };

  // Find all active webhooks subscribed to this event type
  const { prisma } = await import("@/lib/db");
  const webhooks = await prisma.webhook.findMany({
    where: { active: true, events: { has: eventType } },
  });

  for (const wh of webhooks) {
    await enqueueWebhook({
      webhookId: wh.id,
      eventType,
      eventId: event.id,
      payload: event,
    });
  }
}
