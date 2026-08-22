import { describe, expect, it } from "vitest";
import { randomBytes, randomHex, randomUUID } from "@/lib/crypto/random";

describe("randomBytes", () => {
  it("returns a Buffer of the requested length", () => {
    const result = randomBytes(16);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toHaveLength(16);
  });

  it("returns different values on successive calls", () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(a.equals(b)).toBe(false);
  });
});

describe("randomHex", () => {
  it("returns hex of the requested byte length", () => {
    const result = randomHex(16);
    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("returns different values on successive calls", () => {
    expect(randomHex(16)).not.toBe(randomHex(16));
  });
});

describe("randomUUID", () => {
  it("returns a valid UUID v4 format", () => {
    const uuid = randomUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns different values on successive calls", () => {
    expect(randomUUID()).not.toBe(randomUUID());
  });
});