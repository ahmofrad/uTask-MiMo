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

import {
  validateWebhookUrl,
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
  });

  it("rejects .local and .internal hostnames", () => {
    expect(validateWebhookUrl("https://internal.company.local")).toBe(false);
    expect(validateWebhookUrl("https://svc.internal")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(validateWebhookUrl("not-a-url")).toBe(false);
    expect(validateWebhookUrl("")).toBe(false);
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
