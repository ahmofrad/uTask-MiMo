import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "test-encryption-key-for-unit-tests";
});

import { encrypt, decrypt } from "@/lib/crypto/encrypt";

describe("encrypt/decrypt", () => {
  it("encrypts and decrypts roundtrip", () => {
    const plaintext = "my secret webhook payload";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encrypt("same text");
    const b = encrypt("same text");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("encrypted output has iv, ciphertext, tag fields", () => {
    const result = encrypt("test");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("ciphertext");
    expect(result).toHaveProperty("tag");
    expect(typeof result.iv).toBe("string");
    expect(typeof result.ciphertext).toBe("string");
    expect(typeof result.tag).toBe("string");
  });

  it("throws on wrong key decryption", () => {
    const encrypted = encrypt("secret");
    // Tamper with the ciphertext
    const tampered = { ...encrypted, ciphertext: "AAAA" + encrypted.ciphertext.slice(4) };
    expect(() => decrypt(tampered)).toThrow();
  });
});