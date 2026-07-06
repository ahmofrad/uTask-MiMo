import { hmacSign, hmacVerify } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

const BLOCKED_CIDR = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "::1/128",
  "fc00::/7",
];

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr ?? "32", 10);
  const ipBytes = ip.split(".").map(Number);
  const rangeBytes = range!.split(".").map(Number);
  const ipInt = (ipBytes[0]! << 24) + (ipBytes[1]! << 16) + (ipBytes[2]! << 8) + ipBytes[3]!;
  const rangeInt = (rangeBytes[0]! << 24) + (rangeBytes[1]! << 16) + (rangeBytes[2]! << 8) + rangeBytes[3]!;
  const mask = ~0 << (32 - bits);
  return (ipInt & mask) === (rangeInt & mask);
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname;
    // Check if it's an IP
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIP) {
      for (const cidr of BLOCKED_CIDR) {
        if (ipInCidr(host, cidr)) return false;
      }
    }

    // Check against known private hostnames
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function signPayload(payload: string, secret: string): string {
  return hmacSign(payload, secret);
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  return hmacVerify(payload, signature, secret);
}

export async function dispatchWebhook(
  webhookId: string,
  eventType: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
  });
  if (!webhook || !webhook.active) return;

  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhook.secret);

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType,
      eventId,
      attemptNumber: 1,
      requestPayload: payload as never,
      scheduledAt: new Date(),
    },
  });

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TaskApp-Webhooks/1.0",
        "X-TaskApp-Event-Id": eventId,
        "X-TaskApp-Event-Type": eventType,
        "X-TaskApp-Delivery-Id": delivery.id,
        "X-TaskApp-Signature": `sha256=${signature}`,
        "X-TaskApp-Timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text();

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 10000),
        deliveredAt: new Date(),
        durationMs: 0, // approximate
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { error: errorMsg },
    });
    logger.error({ webhookId, eventType, error: errorMsg }, "Webhook dispatch failed");
  }
}
