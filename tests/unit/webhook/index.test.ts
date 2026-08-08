import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/crypto", () => ({
  hmacSign: (payload: string, secret: string) => `hmac:${secret}:${payload}`,
  hmacVerify: (payload: string, signature: string, secret: string) =>
    signature === `hmac:${secret}:${payload}`,
}));

vi.mock("@/lib/crypto/encrypt", () => ({
  decrypt: (payload: { iv: string; ciphertext: string; tag: string }) =>
    `decrypted:${payload.iv}:${payload.ciphertext}:${payload.tag}`,
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logging", () => ({ logger: { error: vi.fn() } }));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === "evil.example.com") {
      return [{ address: "10.0.0.5", family: 4 }];
    }
    if (host === "multi.example.com") {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "192.168.1.5", family: 4 },
      ];
    }
    if (host === "dns-fail.example.com") {
      throw new Error("ENOTFOUND");
    }
    return [{ address: "93.184.216.34", family: 4 }];
  }),
}));

import {
  validateWebhookUrl,
  validateWebhookUrlResolved,
  signPayload,
  verifySignature,
  decryptSecret,
} from "@/lib/webhook";

describe("validateWebhookUrl", () => {
  it("accepts valid https URLs", () => {
    expect(validateWebhookUrl("https://example.com")).toBe(true);
    expect(validateWebhookUrl("https://api.example.com/webhook")).toBe(true);
  });

  it("rejects http URLs", () => {
    expect(validateWebhookUrl("http://example.com")).toBe(false);
  });

  it("rejects localhost", () => {
    expect(validateWebhookUrl("http://localhost:3000")).toBe(false);
    expect(validateWebhookUrl("https://localhost")).toBe(false);
  });

  it("rejects private IPs", () => {
    expect(validateWebhookUrl("http://192.168.1.1")).toBe(false);
    expect(validateWebhookUrl("https://10.0.0.1")).toBe(false);
    expect(validateWebhookUrl("https://172.16.0.1")).toBe(false);
    expect(validateWebhookUrl("https://127.0.0.1")).toBe(false);
    expect(validateWebhookUrl("https://0.0.0.0")).toBe(false);
    expect(validateWebhookUrl("https://100.64.0.1")).toBe(false);
    expect(validateWebhookUrl("https://[::]")).toBe(false);
    expect(validateWebhookUrl("https://[::ffff:127.0.0.1]")).toBe(false);
    expect(validateWebhookUrl("https://[fe80::1]")).toBe(false);
  });

  it("rejects .local and .internal hostnames", () => {
    expect(validateWebhookUrl("https://internal.company.local")).toBe(false);
    expect(validateWebhookUrl("https://svc.internal")).toBe(false);
    expect(validateWebhookUrl("https://localhost.")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(validateWebhookUrl("not-a-url")).toBe(false);
    expect(validateWebhookUrl("")).toBe(false);
  });
});

describe("validateWebhookUrlResolved", () => {
  it("rejects hostnames resolving to private IPs (DNS rebinding)", async () => {
    expect(await validateWebhookUrlResolved("https://evil.example.com")).toBe(false);
  });

  it("rejects hostnames with any private resolved address", async () => {
    expect(await validateWebhookUrlResolved("https://multi.example.com")).toBe(false);
  });

  it("accepts hostnames resolving only to public IPs", async () => {
    expect(await validateWebhookUrlResolved("https://example.com")).toBe(true);
  });

  it("rejects when DNS resolution fails", async () => {
    expect(await validateWebhookUrlResolved("https://dns-fail.example.com")).toBe(false);
  });

  it("passes through literal private IPs (already blocked by validateWebhookUrl)", async () => {
    expect(await validateWebhookUrlResolved("https://10.0.0.1")).toBe(false);
  });
});

describe("signPayload + verifySignature", () => {
  it("roundtrip works", () => {
    const payload = '{"event":"task.created"}';
    const secret = "my-webhook-secret";

    const signature = signPayload(payload, secret);
    expect(verifySignature(payload, signature, secret)).toBe(true);
  });

  it("fails with wrong secret", () => {
    const signature = signPayload("data", "secret-a");
    expect(verifySignature("data", signature, "secret-b")).toBe(false);
  });

  it("fails with wrong payload", () => {
    const signature = signPayload("original", "secret");
    expect(verifySignature("tampered", signature, "secret")).toBe(false);
  });
});

describe("decryptSecret", () => {
  it("decrypts encrypted format (iv:ciphertext:tag)", () => {
    const encrypted = "base64iv:base64ct:base64tag";
    const result = decryptSecret(encrypted);
    expect(result).toBe("decrypted:base64iv:base64ct:base64tag");
  });

  it("returns legacy plaintext as-is", () => {
    const plaintext = "plain-webhook-secret";
    const result = decryptSecret(plaintext);
    expect(result).toBe(plaintext);
  });
});
