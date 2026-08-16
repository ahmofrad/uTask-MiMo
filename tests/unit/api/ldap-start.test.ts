import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLdapAuth = vi.fn();
const mockSignIn = vi.fn();
const mockCreateSsoToken = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/auth/providers/ldap", () => ({
  ldapAuth: mockLdapAuth,
}));
vi.mock("@/lib/auth/config", () => ({
  signIn: mockSignIn,
}));
vi.mock("@/lib/auth/sso-token", () => ({
  createSsoToken: mockCreateSsoToken,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const { POST } = await import("@/app/api/v1/auth/ldap/start/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/ldap/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
  mockLdapAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1", email: "alice@corp.local", displayName: "Alice" },
  });
  mockCreateSsoToken.mockReturnValue("sso-token");
  mockSignIn.mockResolvedValue({ error: null });
});

describe("POST /api/v1/auth/ldap/start", () => {
  it("passes the picked sourceId through to ldapAuth", async () => {
    const response = await POST(request({
      username: "alice",
      password: "secret",
      sourceId: "00000000-0000-4000-8000-000000000031",
    }));

    expect(response.status).toBe(200);
    expect(mockLdapAuth).toHaveBeenCalledWith(
      "alice",
      "secret",
      "00000000-0000-4000-8000-000000000031",
    );
    expect(mockSignIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ ssoToken: "sso-token" }),
    );
  });

  it("omits sourceId for legacy single-source clients", async () => {
    const response = await POST(request({ username: "alice", password: "secret" }));

    expect(response.status).toBe(200);
    expect(mockLdapAuth).toHaveBeenCalledWith("alice", "secret", undefined);
  });

  it("rejects a malformed sourceId", async () => {
    const response = await POST(request({
      username: "alice",
      password: "secret",
      sourceId: "not-a-uuid",
    }));

    expect(response.status).toBe(400);
    expect(mockLdapAuth).not.toHaveBeenCalled();
  });

  it("audits a failed login with the attempted sourceId", async () => {
    mockLdapAuth.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const response = await POST(request({
      username: "alice",
      password: "wrong",
      sourceId: "00000000-0000-4000-8000-000000000031",
    }));

    expect(response.status).toBe(401);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_failed",
        after: expect.objectContaining({
          provider: "ldap",
          username: "alice",
          sourceId: "00000000-0000-4000-8000-000000000031",
        }),
      }),
    );
  });

  it("audits a successful login with the sourceId", async () => {
    await POST(request({
      username: "alice",
      password: "secret",
      sourceId: "00000000-0000-4000-8000-000000000031",
    }));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_success",
        after: expect.objectContaining({
          provider: "ldap",
          sourceId: "00000000-0000-4000-8000-000000000031",
        }),
      }),
    );
  });

  it("rate-limits repeated attempts", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });

    const response = await POST(request({ username: "alice", password: "secret" }));

    expect(response.status).toBe(429);
    expect(mockLdapAuth).not.toHaveBeenCalled();
  });
});
