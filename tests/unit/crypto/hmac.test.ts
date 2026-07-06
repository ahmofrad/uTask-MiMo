import { describe, it, expect } from "vitest";
import { hmacSign, hmacVerify } from "@/lib/crypto/hmac";

describe("hmac", () => {
  const secret = "test-secret-key";
  const payload = "test payload";

  it("sign returns consistent hex string", () => {
    const sig1 = hmacSign(payload, secret);
    const sig2 = hmacSign(payload, secret);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]+$/);
  });

  it("verify returns true for valid signature", () => {
    const sig = hmacSign(payload, secret);
    expect(hmacVerify(payload, sig, secret)).toBe(true);
  });

  it("verify returns false for tampered payload", () => {
    const sig = hmacSign(payload, secret);
    expect(hmacVerify("tampered", sig, secret)).toBe(false);
  });

  it("verify returns false for wrong secret", () => {
    const sig = hmacSign(payload, secret);
    expect(hmacVerify(payload, sig, "wrong-secret")).toBe(false);
  });

  it("verify returns false for wrong signature", () => {
    expect(hmacVerify(payload, "000000", secret)).toBe(false);
  });
});