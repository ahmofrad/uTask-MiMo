import { hmacSign, hmacVerify } from "@/lib/crypto";
import { decrypt } from "@/lib/crypto/encrypt";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

const BLOCKED_CIDR = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "192.0.0.0/24",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "::1/128",
  "::/128",
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
  const normalizedHost = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const mappedIpv4 = normalizedHost.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return isPrivateIp(mappedIpv4[1]!);
  const mappedHex = normalizedHost.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const first = parseInt(mappedHex[1]!, 16);
    const second = parseInt(mappedHex[2]!, 16);
    return isPrivateIp(`${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`);
  }

  // IPv4 check
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalizedHost)) {
    const ipBytes = normalizedHost.split(".").map(Number);
    if (ipBytes.some((byte) => byte > 255)) return true;
    for (const cidr of BLOCKED_CIDR) {
      if (cidr.includes(":")) continue;
      if (ipInCidr(normalizedHost, cidr)) return true;
    }
    return false;
  }

  // IPv6 check (including IPv4-mapped ::ffff:x.x.x.x)
  if (normalizedHost.includes(":")) {
    if (normalizedHost === "::" || normalizedHost === "::1") return true;
    const firstHextet = parseInt(normalizedHost.split(":")[0] || "0", 16);
    if ((firstHextet >= 0xfe80 && firstHextet <= 0xfebf) || firstHextet >= 0xfc00) return true;
    for (const cidr of BLOCKED_CIDR) {
      if (!cidr.includes(":")) continue;
      if (ipInCidr(normalizedHost, cidr)) return true;
    }
    return false;
  }

  return false;
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");

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

/**
 * Resolves the webhook hostname and verifies no resolved address points at a
 * private/internal network. This closes the DNS-rebinding-style gap where a
 * hostname passes the literal string check but resolves to a private IP.
 */
type ResolvedWebhookAddress = {
  address: string;
  family: 4 | 6;
};

async function resolveSafeWebhookAddress(url: string): Promise<ResolvedWebhookAddress | null> {
  if (!validateWebhookUrl(url)) return null;

  let host: string;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }

  // Literal IPs are already covered by validateWebhookUrl. Returning the literal
  // address lets the request connect without doing a second DNS lookup.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) {
    return isPrivateIp(host) ? null : { address: host, family: host.includes(":") ? 6 : 4 };
  }

  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((addr) => isPrivateIp(addr.address))) return null;
    const publicAddress = addresses[0]!;
    return { address: publicAddress.address, family: publicAddress.family === 6 ? 6 : 4 };
  } catch {
    // DNS failure — reject rather than deliver into an unknown network.
    return null;
  }
}

export async function validateWebhookUrlResolved(url: string): Promise<boolean> {
  return (await resolveSafeWebhookAddress(url)) !== null;
}

function postWebhookRequest(
  url: string,
  body: string,
  headers: Record<string, string>,
  resolvedAddress: ResolvedWebhookAddress,
): Promise<{ status: number; body: string }> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const requestOptions = {
    hostname: resolvedAddress.address,
    port: parsed.port ? Number(parsed.port) : 443,
    path: `${parsed.pathname}${parsed.search}`,
    method: "POST" as const,
    headers: {
      ...headers,
      Host: parsed.host,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    timeout: 10_000,
  };

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      { ...requestOptions, servername: hostname },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (size < 10_000) {
            const remaining = 10_000 - size;
            chunks.push(buffer.subarray(0, remaining));
            size += Math.min(buffer.length, remaining);
          }
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 502,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Webhook request timed out")));
    request.on("error", reject);
    request.end(body);
  });
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

/** Thrown when a stored webhook secret cannot be decrypted (encryption key changed). */
export class WebhookSecretUndecryptableError extends Error {}

/**
 * Classifies the stored signing secret: `ok` when it decrypts (or is a legacy
 * plaintext secret), `broken` when the blob exists but fails to decrypt — e.g.
 * WEBHOOK_SECRET_ENCRYPTION_KEY changed between restarts/deployments. The
 * admin list must surface `broken` instead of pretending deliveries work.
 */
export function webhookSecretState(stored: string): "ok" | "broken" {
  try {
    decryptSecret(stored);
    return "ok";
  } catch {
    return "broken";
  }
}

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

  // Resolve and pin a public address at dispatch time. Connecting by IP avoids
  // a second DNS lookup between validation and the outbound request.
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
