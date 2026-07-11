import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createApiToken, normalizeScopes, invalidScopes, userCanGrantScope } from "@/lib/api-token";
import { POST } from "@/app/api/v1/public/tokens/route";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let memberId = "";
let bearer = "";

async function callPost(scopes: unknown) {
  const res = await POST(
    new Request("http://localhost/api/v1/public/tokens", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ name: "test-token", scopes }),
    }),
  );
  return { status: res.status, body: (await res.json()) as { error?: { code: string }; data?: { scopes?: string[] } } };
}

maybe("api token minting security", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `mint-${Date.now()}@example.com`, displayName: "Minter", status: "active" },
    });
    memberId = u.id;
    await prisma.role.create({
      data: { userId: u.id, scopeType: "global", scopeId: null, type: "member" },
    });
    const tok = await createApiToken({ userId: u.id, name: "caller", scopes: ["tasks:read"] });
    bearer = tok.raw;
  });

  afterAll(async () => {
    await prisma.apiToken.deleteMany({ where: { userId: memberId } });
    await prisma.role.deleteMany({ where: { userId: memberId } });
    await prisma.user.deleteMany({ where: { id: memberId } });
  });

  it("rejects scopes outside the allowlist (400 INVALID_SCOPE)", async () => {
    const r = await callPost(["tasks:read", "org:manage"]);
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe("INVALID_SCOPE");
  });

  it("rejects scopes the user is not entitled to grant (403 FORBIDDEN)", async () => {
    const r = await callPost(["projects:write"]);
    expect(r.status).toBe(403);
    expect(r.body.error?.code).toBe("FORBIDDEN");
  });

  it("rejects an empty scopes array (400)", async () => {
    const r = await callPost([]);
    expect(r.status).toBe(400);
  });

  it("allows scopes the user can grant (201)", async () => {
    const r = await callPost(["tasks:write", "comments:write"]);
    expect(r.status).toBe(201);
    expect(r.body.data?.scopes).toEqual(expect.arrayContaining(["tasks:write", "comments:write"]));
  });

  it("normalizeScopes dedupes and drops non-strings", () => {
    expect(normalizeScopes(["a", "a", 1, null, ""])).toEqual(["a"]);
    expect(normalizeScopes("not-array")).toBeNull();
  });

  it("invalidScopes filters out-of-allowlist values", () => {
    expect(invalidScopes(["tasks:read", "x:y"])).toEqual(["x:y"]);
  });

  it("userCanGrantScope reflects RBAC", async () => {
    expect(await userCanGrantScope(memberId, "tasks:write")).toBe(true);
    expect(await userCanGrantScope(memberId, "comments:write")).toBe(true);
    expect(await userCanGrantScope(memberId, "projects:write")).toBe(false);
    expect(await userCanGrantScope(memberId, "users:write")).toBe(false);
    expect(await userCanGrantScope(memberId, "tasks:read")).toBe(true);
    expect(await userCanGrantScope(memberId, "unknown:scope")).toBe(false);
  });
});
