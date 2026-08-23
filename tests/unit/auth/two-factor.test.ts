import { describe, expect, it } from "vitest";
import {
  generateSecret,
  verifyTotp,
  generateQrCodeUri,
  generateRecoveryCodes,
  _internals,
} from "@/lib/auth/two-factor";

// RFC 6238 Appendix B test vectors — TOTP with SHA-1, 8-digit codes for
// reference, 6-digit for our implementation. We derive counter windows from
// the Unix times in the RFC, and verify known 6-digit codes at the same
// window (from RFC 4226 for HOTP semantics, adapted to TOTP windows).
describe("TOTP core (RFC 6238 / 4226 semantics)", () => {
  // HOTP test vector from RFC 4226 Appendix D with counter values; TOTP code
  // at window N equals HOTP(key, N). We use these to validate our HOTP.
  it("computes correct HOTP values for the RFC 4226 key (SHA-1)", () => {
    // RFC 4226 key: 0x3132333435363738393031323334353637383930 ("12345678901234567890")
    const key = Buffer.from("12345678901234567890", "utf8").toString("base64");

    // HOTP values for counters 0..3 per RFC 4226 Appendix B
    const expected = ["755224", "287082", "359152", "969429"];

    for (let counter = 0; counter < expected.length; counter++) {
      const code = computeHotpBase64(key, counter, 6);
      expect(code).toBe(expected[counter]);
    }
  });

  it("generates 6-digit codes only", () => {
    const secret = generateSecret();
    const now = Date.now();
    const t0 = Math.floor(now / 30000) * 30000;
    for (let offset = -2; offset <= 2; offset++) {
      const code = computeTotpAt(secret, t0 + offset * 30000);
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from("Hello, TOTP world! 1234567890", "utf8");
    const encoded = _internals.base32Encode(bytes);
    const decoded = _internals.base32Decode(encoded);
    expect(decoded.equals(bytes)).toBe(true);
  });

  it("is case-insensitive and ignores separators", () => {
    const bytes = Buffer.from("secret", "utf8");
    const encoded = _internals.base32Encode(bytes);
    expect(_internals.base32Decode(encoded.toLowerCase())).toEqual(bytes);
    // "======" padding and spaces removed by decoder
    expect(_internals.base32Decode(encoded + "======").equals(bytes)).toBe(true);
  });
});

describe("verifyTotp", () => {
  it("accepts the current-window code", () => {
    const secret = generateSecret();
    const code = computeTotpAt(secret, Date.now());
    expect(verifyTotp(secret, code, Date.now())).toBe(true);
  });

  it("accepts codes from ±1 window (30 s drift)", () => {
    const secret = generateSecret();
    const now = Date.now();
    const past = computeTotpAt(secret, now - 30000);
    const future = computeTotpAt(secret, now + 30000);
    expect(verifyTotp(secret, past, now)).toBe(true);
    expect(verifyTotp(secret, future, now)).toBe(true);
  });

  it("rejects codes older than the drift window", () => {
    const secret = generateSecret();
    const now = Date.now();
    expect(verifyTotp(secret, computeTotpAt(secret, now - 90000), now)).toBe(false);
  });

  it("rejects non-numeric or wrong-length tokens", () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, "abc123", Date.now())).toBe(false);
    expect(verifyTotp(secret, "12345", Date.now())).toBe(false);
    expect(verifyTotp(secret, "1234567", Date.now())).toBe(false);
    expect(verifyTotp(secret, "", Date.now())).toBe(false);
  });

  it("rejects an empty/improper secret", () => {
    expect(verifyTotp("", "123456", Date.now())).toBe(false);
  });
});

describe("generateQrCodeUri", () => {
  it("produces an otpauth:// URI with encoded label and issuer", () => {
    const uri = generateQrCodeUri("alice@example.com", "uTask", "JBSWY3DPEHPK3PXP");
    expect(uri).toContain("otpauth://totp/uTask:alice%40example.com");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=uTask");
  });
});

describe("generateRecoveryCodes", () => {
  it("produces the requested count of 12-char codes", () => {
    const { plain, hashed } = generateRecoveryCodes(8);
    expect(plain).toHaveLength(8);
    expect(hashed).toHaveLength(8);
    for (const code of plain) {
      expect(code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    }
  });

  it("hashes the plaintext codes (never stores them raw)", () => {
    const { plain, hashed } = generateRecoveryCodes(4);
    for (let i = 0; i < plain.length; i++) {
      expect(hashed[i]).toMatch(/^[0-9a-f]{64}$/);
      expect(hashed[i]).not.toContain(plain[i]);
    }
  });

  it("produces distinct codes", () => {
    const { plain } = generateRecoveryCodes(8);
    expect(new Set(plain).size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Helpers — re-implement TOTP/HOTP here independently of the module under test
// so the tests are meaningful (not mirroring the same bug).
// ---------------------------------------------------------------------------

function base32EncodeForTest(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 0x1f];
  return out;
}

function base32DecodeForTest(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const upper = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of upper) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

function hotpRaw(keyBytes: Buffer, counter: number): number {
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", keyBytes).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  return (
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  );
}

function computeHotpBase64(keyBase64: string, counter: number, digits = 6): string {
  const key = Buffer.from(keyBase64, "base64");
  return (hotpRaw(key, counter) % Math.pow(10, digits)).toString().padStart(digits, "0");
}

function computeTotpAt(secretBase32: string, atMs: number): string {
  const keyBytes = base32DecodeForTest(secretBase32);
  const counter = Math.floor(atMs / 30000);
  return (hotpRaw(keyBytes, counter) % Math.pow(10, 6)).toString().padStart(6, "0");
}