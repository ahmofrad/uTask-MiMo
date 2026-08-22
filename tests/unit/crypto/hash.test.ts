import { describe, expect, it } from "vitest";
import { sha256, sha256Buffer } from "@/lib/crypto/hash";

describe("sha256", () => {
  it("returns a 64-char hex string", () => {
    const result = sha256("hello");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("produces different hashes for different inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });

  it("matches a known SHA-256 value", () => {
    // Known: echo -n "hello" | sha256sum
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("sha256Buffer", () => {
  it("returns a 32-byte Buffer", () => {
    const result = sha256Buffer("hello");
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toHaveLength(32);
  });

  it("matches hex output of sha256", () => {
    expect(sha256Buffer("hello").toString("hex")).toBe(sha256("hello"));
  });
});