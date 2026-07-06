import { describe, it, expect } from "vitest";
import { generateToken, tokenHasScope } from "@/lib/api-token/index";

describe("generateToken", () => {
  it("returns raw token with tk_ prefix", () => {
    const { raw } = generateToken();
    expect(raw).toMatch(/^tk_/);
  });

  it("returns a 64-char hex hash", () => {
    const { hash } = generateToken();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns prefix of length 7 (tk_ + 4 chars)", () => {
    const { prefix } = generateToken();
    expect(prefix).toMatch(/^tk_[a-zA-Z0-9]{4}$/);
  });

  it("produces unique tokens on each call", () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1.raw).not.toBe(t2.raw);
  });
});

describe("tokenHasScope", () => {
  const scopes = ["tasks:read", "projects:read"];

  it("returns true when scope is present", () => {
    expect(tokenHasScope(scopes, "tasks:read")).toBe(true);
  });

  it("returns false when scope is missing", () => {
    expect(tokenHasScope(scopes, "tasks:write")).toBe(false);
  });

  it("returns false for empty scopes array", () => {
    expect(tokenHasScope([], "tasks:read")).toBe(false);
  });
});