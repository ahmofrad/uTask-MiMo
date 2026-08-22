import { describe, expect, it } from "vitest";
import { hmacSign, hmacVerify } from "@/lib/crypto/hmac";

describe("hmacSign", () => {
  it("returns a 64-char hex string", () => {
    const result = hmacSign("hello", "secret");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for same payload and secret", () => {
    expect(hmacSign("hello", "secret")).toBe(hmacSign("hello", "secret"));
  });

  it("produces different signatures for different secrets", () => {
    expect(hmacSign("hello", "secret1")).not.toBe(hmacSign("hello", "secret2"));
  });

  it("produces different signatures for different payloads", () => {
    expect(hmacSign("hello", "secret")).not.toBe(hmacSign("world", "secret"));
  });
});

describe("hmacVerify", () => {
  it("returns true for a valid signature", () => {
    const signature = hmacSign("hello", "secret");
    expect(hmacVerify("hello", signature, "secret")).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(hmacVerify("hello", "badbad".repeat(32), "secret")).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const signature = hmacSign("hello", "secret");
    expect(hmacVerify("hello", signature, "wrong")).toBe(false);
  });

  it("returns false for tampered payload", () => {
    const signature = hmacSign("hello", "secret");
    expect(hmacVerify("world", signature, "secret")).toBe(false);
  });
});