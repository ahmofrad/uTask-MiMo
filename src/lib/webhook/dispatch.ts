import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";
import { decryptSecret, signPayload, WebhookSecretUndecryptableError } from "./signing";
import { resolveSafeWebhookAddress } from "./ssrf";
import { postWebhookRequest } from "./http";

export async function dispatchWebhook(
  webhookId: string,
  eventType: string,
  eventId: string,
  payload: Record<string, unknown>,
  deliveryId?: string,
  attemptNumber = 1,
) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId, deletedAt: null },
  });
  if (!webhook || !webhook.active) return;

  const body = JSON.stringify(payload);

  let secret: string;
  try {
    secret = decryptSecret(webhook.secret);
  } catch {
    const message =
      "Webhook signing secret cannot be decrypted — WEBHOOK_SECRET_ENCRYPTION_KEY may have changed. Delete and re-create the webhook to issue a new secret.";
    logger.error({ webhookId, eventType }, message);
    if (deliveryId) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { error: message, nextRetryAt: null },
      });
      return;
    }
    throw new WebhookSecretUndecryptableError(message);
  }
  const signature = signPayload(body, secret);

  const resolvedAddress = await resolveSafeWebhookAddress(webhook.url);
  if (!resolvedAddress) {
    logger.error({ webhookId, eventType }, "Webhook dispatch blocked: URL failed resolution check");
    if (deliveryId) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { error: "Webhook URL failed SSRF validation", nextRetryAt: null },
      });
    }
    return;
  }

  const delivery = deliveryId
    ? { id: deliveryId }
    : await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType,
          eventId,
          attemptNumber,
          requestPayload: payload as never,
          scheduledAt: new Date(),
        },
      });
  if (deliveryId) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attemptNumber, scheduledAt: new Date(), nextRetryAt: null, error: null },
    });
  }

  const startedAt = Date.now();
  try {
    const response = await postWebhookRequest(
      webhook.url,
      body,
      {
        "Content-Type": "application/json",
        "User-Agent": "TaskApp-Webhooks/1.0",
        "X-TaskApp-Event-Id": eventId,
        "X-TaskApp-Event-Type": eventType,
        "X-TaskApp-Delivery-Id": delivery.id,
        "X-TaskApp-Signature": `sha256=${signature}`,
        "X-TaskApp-Timestamp": String(Math.floor(Date.now() / 1000)),
      },
      resolvedAddress,
    );

    const responseBody = response.body;
    const durationMs = Date.now() - startedAt;

    if (response.status < 200 || response.status >= 300) {
      const errorMsg = `Webhook returned HTTP ${response.status}`;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 10000),
          error: errorMsg,
          durationMs,
          nextRetryAt: new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** Math.max(0, attemptNumber - 1))),
        },
      });
      throw new Error(errorMsg);
    }

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 10000),
        deliveredAt: new Date(),
        error: null,
        durationMs,
        nextRetryAt: null,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    if (!errorMsg.startsWith("Webhook returned HTTP ")) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          error: errorMsg,
          durationMs: Date.now() - startedAt,
          nextRetryAt: new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** Math.max(0, attemptNumber - 1))),
        },
      });
    }
    logger.error({ webhookId, eventType, error: errorMsg }, "Webhook dispatch failed");
    throw err instanceof Error ? err : new Error(errorMsg);
  }
}