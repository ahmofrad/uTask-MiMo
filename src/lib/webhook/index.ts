import { hmacSign, hmacVerify } from "@/lib/crypto";
import { decrypt } from "@/lib/crypto/encrypt";
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
  "fe80::/10",
  "::ffff:0:0/96",
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  ".local",
  ".internal",
  ".localhost",
];

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr ?? "32", 10);

  // IPv4
  if (ip.includes(".")) {
    const ipBytes = ip.split(".").map(Number);
    const rangeBytes = range!.split(".").map(Number);
    if (ipBytes.length !== 4 || rangeBytes.length !== 4) return false;
    const ipInt = (ipBytes[0]! << 24) + (ipBytes[1]! << 16) + (ipBytes[2]! << 8) + ipBytes[3]!;
    const rangeInt = (rangeBytes[0]! << 24) + (rangeBytes[1]! << 16) + (rangeBytes[2]! << 8) + rangeBytes[3]!;
    const mask = ~0 << (32 - bits);
    return (ipInt & mask) === (rangeInt & mask);
  }

  // IPv6 — use string-based comparison (avoids BigInt ES2020 requirement)
  const parseIpv6 = (addr: string): string | null => {
    // Expand :: abbreviation
    const parts = addr.split("::");
    if (parts.length > 2) return null;
    const [head, tail] = parts;
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const full = [...headParts, ...Array(missing).fill("0"), ...tailParts];
    if (full.length !== 8) return null;
    // Normalize to 32 hex chars (128 bits)
    return full.map((p) => p.padStart(4, "0")).join("");
  };

  const ipHex = parseIpv6(ip);
  const rangeHex = parseIpv6(range ?? "");
  if (!ipHex || !rangeHex) return false;

  // Apply mask by zeroing out trailing bits
  const totalHexChars = 32; // 128 bits = 32 hex chars
  const maskChars = Math.floor(bits / 4);
  const maskPartialBits = bits % 4;

  let maskedIp = ipHex.slice(0, maskChars);
  let maskedRange = rangeHex.slice(0, maskChars);

  if (maskPartialBits > 0 && maskChars < totalHexChars) {
    const partialMask = (0xf0 >> maskPartialBits) & 0xf;
    maskedIp += (parseInt(ipHex[maskChars]!, 16) & partialMask).toString(16);
    maskedRange += (parseInt(rangeHex[maskChars]!, 16) & partialMask).toString(16);
    maskedIp += ipHex.slice(maskChars + 1);
    maskedRange += rangeHex.slice(maskChars + 1);
  } else {
    maskedIp += ipHex.slice(maskChars);
    maskedRange += rangeHex.slice(maskChars);
  }

  return maskedIp === maskedRange;
}

function isPrivateIp(host: string): boolean {
  // IPv4 check
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    for (const cidr of BLOCKED_CIDR) {
      if (cidr.includes(":")) continue;
      if (ipInCidr(host, cidr)) return true;
    }
    return false;
  }

  // IPv6 check (including IPv4-mapped ::ffff:x.x.x.x)
  if (host.includes(":")) {
    for (const cidr of BLOCKED_CIDR) {
      if (!cidr.includes(":")) continue;
      if (ipInCidr(host, cidr)) return true;
    }
    return false;
  }

  return false;
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname;

    // Check against blocked private hostnames
    for (const suffix of BLOCKED_HOSTNAMES) {
      if (host === suffix.slice(1) || host.endsWith(suffix)) return false;
    }

    // Check IP addresses (v4 and v6)
    if (isPrivateIp(host)) return false;

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

export function decryptSecret(encryptedSecret: string): string {
  // Support both encrypted (iv:ciphertext:tag) and legacy plaintext formats
  const parts = encryptedSecret.split(":");
  if (parts.length === 3) {
    return decrypt({ iv: parts[0]!, ciphertext: parts[1]!, tag: parts[2]! });
  }
  return encryptedSecret;
}

export async function dispatchWebhook(
  webhookId: string,
  eventType: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId, deletedAt: null },
  });
  if (!webhook || !webhook.active) return;

  const body = JSON.stringify(payload);
  const secret = decryptSecret(webhook.secret);
  const signature = signPayload(body, secret);

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
      redirect: "manual",
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
