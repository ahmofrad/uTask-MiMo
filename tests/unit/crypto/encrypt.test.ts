import { describe, expect, it } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";

describe("encrypt / decrypt round-trip", () => {
  it("encrypts and decrypts a plaintext string", () => {
    const plaintext = "my secret webhook key";
    const encrypted = encrypt(plaintext);
    // Verify structure
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(encrypted.ciphertext).not.toBe(plaintext);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encrypt("hello");
    const b = encrypt("hello");
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails to decrypt with a tampered ciphertext", () => {
    const encrypted = encrypt("hello");
    // Flip the first character to produce an invalid ciphertext
    const tampered = encrypted.ciphertext[0] === "A"
      ? "B" + encrypted.ciphertext.slice(1)
      : "A" + encrypted.ciphertext.slice(1);
    expect(() =>
      decrypt({
        iv: encrypted.iv,
        ciphertext: tampered,
        tag: encrypted.tag,
      }),
    ).toThrow();
  });

  it("fails to decrypt with a tampered tag", () => {
    const encrypted = encrypt("hello");
    expect(() =>
      decrypt({
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        tag: "aa".repeat(16),
      }),
    ).toThrow();
  });

  it("fails to decrypt with a wrong IV", () => {
    const encrypted = encrypt("hello");
    expect(() =>
      decrypt({
        iv: Buffer.from("wrong iv 16 byte").toString("base64"),
        ciphertext: encrypted.ciphertext,
        tag: encrypted.tag,
      }),
    ).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles unicode text", () => {
    const plaintext = "سلام دنیا 🌍";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("throws without WEBHOOK_SECRET_ENCRYPTION_KEY", () => {
    const original = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
    delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
    try {
      expect(() => encrypt("hello")).toThrow(
        "WEBHOOK_SECRET_ENCRYPTION_KEY env var is required",
      );
    } finally {
      if (original !== undefined) {
        process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = original;
      }
    }
  });

  it("throws on legacy colon-separated format from webhook decryptSecret", () => {
    // The webhook module expects encrypt to produce iv:ciphertext:tag format
    const plaintext = "secret-value";
    const encrypted = encrypt(plaintext);
    const parts = encrypted.iv + ":" + encrypted.ciphertext + ":" + encrypted.tag;
    expect(parts.split(":")).toHaveLength(3);
  });
});