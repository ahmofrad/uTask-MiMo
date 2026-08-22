import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLookupToken = vi.fn();
const mockTokenHasScope = vi.fn();
const mockRateLimitIp = vi.fn();
const mockRateLimitUser = vi.fn();
const mockRateLimitToken = vi.fn();

vi.mock("@/lib/api-token", () => ({
  lookupToken: (...args: unknown[]) => mockLookupToken(...args),
  tokenHasScope: (...args: unknown[]) => mockTokenHasScope(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitIp: (...args: unknown[]) => mockRateLimitIp(...args),
  checkRateLimitUser: (...args: unknown[]) => mockRateLimitUser(...args),
  checkRateLimitToken: (...args: unknown[]) => mockRateLimitToken(...args),
}));

import { authenticatePublicApi, rateLimitHeaders } from "@/lib/public-api/middleware";

const validToken = { id: "tok1", userId: "u1", scopes: ["tasks:read", "tasks:write"], revokedAt: null };

function makeRequest(overrides: { auth?: string | null; forwarded?: string | null; realIp?: string | null } = {}) {
  const headers = new Headers();
  if (overrides.auth !== undefined && overrides.auth !== null) headers.set("authorization", overrides.auth);
  if (overrides.forwarded) headers.set("x-forwarded-for", overrides.forwarded);
  if (overrides.realIp) headers.set("x-real-ip", overrides.realIp);
  return new Request("http://localhost/api/v1/public/tasks", { headers });
}

describe("authenticatePublicApi", () => {
  beforeEach(() => {
    mockLookupToken.mockReset().mockResolvedValue(validToken);
    mockTokenHasScope.mockReset().mockImplementation((_scopes, scope) => scope !== "admin:all");
    mockRateLimitIp.mockReset().mockResolvedValue({ allowed: true, limit: 100, remaining: 99, resetAt: Date.now() + 60_000 });
    mockRateLimitUser.mockReset().mockResolvedValue({ allowed: true, limit: 500, remaining: 499, resetAt: Date.now() + 60_000 });
    mockRateLimitToken.mockReset().mockResolvedValue({ allowed: true, limit: 1000, remaining: 999, resetAt: Date.now() + 60_000 });
  });

  it("rejects requests without a Bearer header", async () => {
    const result = await authenticatePublicApi(makeRequest());
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
    expect(result.userId).toBe("");
  });

  it("rejects requests with a non-Bearer scheme", async () => {
    const result = await authenticatePublicApi(makeRequest({ auth: "Basic abc" }));
    expect(result.error!.status).toBe(401);
  });

  it("rejects unknown or revoked tokens", async () => {
    mockLookupToken.mockResolvedValue(null);
    const result = await authenticatePublicApi(makeRequest({ auth: "Bearer deadbeef" }));
    expect(result.error!.status).toBe(401);
  });

  it("returns the token's userId on success", async () => {
    const result = await authenticatePublicApi(makeRequest({ auth: "Bearer tok-raw" }));
    expect(result.error).toBeUndefined();
    expect(result.userId).toBe("u1");
  });

  it("returns 403 when the token lacks the required scope", async () => {
    const result = await authenticatePublicApi(makeRequest({ auth: "Bearer tok-raw" }), "admin:all");
    expect(result.error!.status).toBe(403);
  });

  it("returns 429 with rate limit headers when blocked", async () => {
    mockRateLimitToken.mockResolvedValue({ allowed: false, limit: 1000, remaining: 0, resetAt: Date.now() + 30_000 });
    const result = await authenticatePublicApi(makeRequest({ auth: "Bearer tok-raw" }));
    expect(result.error!.status).toBe(429);
    expect(result.error!.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(result.error!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result.error!.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);
  });

  it("uses the first x-forwarded-for IP for rate limiting", async () => {
    await authenticatePublicApi(makeRequest({ auth: "Bearer tok-raw", forwarded: "203.0.113.9, 10.0.0.1" }));
    expect(mockRateLimitIp).toHaveBeenCalledWith("203.0.113.9");
  });
});

describe("rateLimitHeaders", () => {
  it("formats limit, remaining and reset as strings", () => {
    expect(rateLimitHeaders(100, 42, 17)).toEqual({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "42",
      "X-RateLimit-Reset": "17",
    });
  });
});