import { describe, it, expect } from "vitest";
import { sha256, sha256Buffer } from "@/lib/crypto/hash";

describe("sha256", () => {
  it("returns consistent hex for same input", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });
  it("returns different output for different input", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });
  it("returns 64-char hex string", () => {
    const hash = sha256("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("handles empty string", () => {
    const hash = sha256("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("sha256Buffer", () => {
  it("returns a Buffer of 32 bytes", () => {
    const buf = sha256Buffer("test");
    expect(buf.length).toBe(32);
  });
});