import { describe, it, expect, vi } from "vitest";
import { createSsoToken, verifySsoToken } from "@/lib/auth/sso-token";

describe("sso token", () => {
  it("roundtrips a valid token", () => {
    const token = createSsoToken("user@example.com", "ldap");
    const verified = verifySsoToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.email).toBe("user@example.com");
    expect(verified!.provider).toBe("ldap");
  });

  it("rejects a tampered signature", () => {
    const token = createSsoToken("user@example.com", "ldap");
    const last = token.slice(-1);
    const tampered = token.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(verifySsoToken(tampered)).toBeNull();
  });

  it("rejects malformed or missing tokens", () => {
    expect(verifySsoToken(undefined)).toBeNull();
    expect(verifySsoToken(null)).toBeNull();
    expect(verifySsoToken("not-a-token")).toBeNull();
    expect(verifySsoToken("payloadonly")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const token = createSsoToken("user@example.com", "saml");
    vi.advanceTimersByTime(61_000);
    expect(verifySsoToken(token)).toBeNull();
    vi.useRealTimers();
  });
});
