import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockListLdapSources = vi.fn();
const mockGetLdapSource = vi.fn();
const mockRedact = vi.fn();
const mockSourceFindMany = vi.fn();
const mockSourceFindFirst = vi.fn();
const mockSourceCreate = vi.fn();
const mockSourceUpdate = vi.fn();
const mockTestConnection = vi.fn();
const mockSyncLdapSource = vi.fn();
const mockSourceToConfig = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/auth/ldap-sources", () => ({
  listLdapSources: mockListLdapSources,
  getLdapSource: mockGetLdapSource,
  redactLdapSource: mockRedact,
  sourceToLdapConfig: mockSourceToConfig,
}));
vi.mock("@/lib/auth/providers/ldap", () => ({
  testLdapConnection: mockTestConnection,
  syncLdapSource: mockSyncLdapSource,
}));
vi.mock("@/lib/crypto/encrypt", () => ({
  encrypt: (value: string) => ({ iv: "iv", ciphertext: value, tag: "tag" }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSource: {
      findMany: mockSourceFindMany,
      findFirst: mockSourceFindFirst,
      create: mockSourceCreate,
      update: mockSourceUpdate,
    },
  },
}));

const collection = await import("@/app/api/v1/admin/ldap-sources/route");
const item = await import("@/app/api/v1/admin/ldap-sources/[id]/route");
const testRoute = await import("@/app/api/v1/admin/ldap-sources/[id]/test/route");
const syncRoute = await import("@/app/api/v1/admin/ldap-sources/[id]/sync/route");

function jsonRequest(body: unknown, url = "http://localhost/api/v1/admin/ldap-sources"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authGuardOk() {
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
}

beforeEach(() => {
  vi.clearAllMocks();
  authGuardOk();
  mockRedact.mockImplementation((source: Record<string, unknown>) => ({ ...source, bindPasswordConfigured: true }));
  mockGetLdapSource.mockResolvedValue({
    id: "src-1",
    name: "Corp",
    enabled: true,
    url: "ldaps://dc.corp.local:636",
    bindUpn: "svc@corp.local",
    bindPassword: "plain-secret",
  });
});

describe("GET /api/v1/admin/ldap-sources", () => {
  it("lists sources redacted for admin display", async () => {
    mockListLdapSources.mockResolvedValue([{ id: "src-1", name: "Corp" }]);
    const response = await collection.GET();
    expect(response.status).toBe(200);
    expect(mockListLdapSources).toHaveBeenCalled();
    expect(mockRedact).toHaveBeenCalled();
    const body = await response.json();
    expect(body.data).toEqual([expect.objectContaining({ id: "src-1", bindPasswordConfigured: true })]);
  });

  it("denies users without sso:configure", async () => {
    mockRequirePermission.mockReturnValueOnce(
      async () => NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    );
    const response = await collection.GET();
    expect(response.status).toBe(403);
    expect(mockListLdapSources).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/admin/ldap-sources", () => {
  it("creates a source with the password encrypted at rest", async () => {
    mockSourceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "new-1",
      ...data,
    }));
    mockRedact.mockImplementation((source: Record<string, unknown>) => source);

    const response = await collection.POST(jsonRequest({
      name: "Corp",
      enabled: true,
      url: "ldaps://dc.corp.local:636",
      bindUpn: "svc@corp.local",
      bindPassword: "super-secret",
    }));

    expect(response.status).toBe(201);
    expect(mockSourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bindPassword: "iv:super-secret:tag",
        upnSuffix: null,
        searchBase: null,
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", entityType: "ldapsource", entityId: "new-1" }),
    );
  });

  it("rejects invalid payloads", async () => {
    const response = await collection.POST(jsonRequest({ name: "X" }));
    expect(response.status).toBe(400);
    expect(mockSourceCreate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/admin/ldap-sources/[id]", () => {
  it("updates fields and encrypts a replacement password", async () => {
    mockSourceUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "src-1",
      name: "Corp",
      ...data,
    }));

    const response = await item.PATCH(
      jsonRequest({ enabled: false, bindPassword: "new-pass" }),
      { params: Promise.resolve({ id: "src-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockSourceUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.objectContaining({
        enabled: false,
        bindPassword: "iv:new-pass:tag",
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", entityType: "ldapsource", entityId: "src-1" }),
    );
  });

  it("keeps the existing password when bindPassword is empty", async () => {
    mockSourceUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "src-1",
      name: "Corp",
      ...data,
    }));

    await item.PATCH(jsonRequest({ name: "Renamed" }), { params: Promise.resolve({ id: "src-1" }) });

    expect(mockSourceUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.not.objectContaining({ bindPassword: expect.anything() }),
    });
  });

  it("404s for an unknown source", async () => {
    mockGetLdapSource.mockResolvedValue(null);
    const response = await item.PATCH(jsonRequest({ name: "X" }), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    expect(mockSourceUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty update body", async () => {
    const response = await item.PATCH(jsonRequest({}), { params: Promise.resolve({ id: "src-1" }) });
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/admin/ldap-sources/[id]", () => {
  it("soft-deletes and disables the source", async () => {
    mockSourceUpdate.mockResolvedValue({ id: "src-1" });
    const response = await item.DELETE(
      new Request("http://localhost/api/v1/admin/ldap-sources/src-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "src-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mockSourceUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.objectContaining({ deletedAt: expect.any(Date), enabled: false }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "deleted" }));
  });

  it("404s for an unknown source", async () => {
    mockGetLdapSource.mockResolvedValue(null);
    const response = await item.DELETE(
      new Request("http://localhost/api/v1/admin/ldap-sources/missing", { method: "DELETE" }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/admin/ldap-sources/[id]/test", () => {
  it("tests the stored source config", async () => {
    mockSourceToConfig.mockReturnValue({ url: "ldaps://dc.corp.local:636" });
    mockTestConnection.mockResolvedValue({ ok: true });

    const response = await testRoute.POST(
      new Request("http://localhost/api/v1/admin/ldap-sources/src-1/test", { method: "POST" }),
      { params: Promise.resolve({ id: "src-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockTestConnection).toHaveBeenCalledWith({ url: "ldaps://dc.corp.local:636" });
    const body = await response.json();
    expect(body.data.ok).toBe(true);
  });

  it("404s for an unknown source", async () => {
    mockGetLdapSource.mockResolvedValue(null);
    const response = await testRoute.POST(
      new Request("http://localhost/api/v1/admin/ldap-sources/missing/test", { method: "POST" }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/admin/ldap-sources/[id]/sync", () => {
  it("syncs one source and audits the result", async () => {
    mockSyncLdapSource.mockResolvedValue({ groups: 2, users: 5 });

    const response = await syncRoute.POST(
      new Request("http://localhost/api/v1/admin/ldap-sources/src-1/sync", { method: "POST" }),
      { params: Promise.resolve({ id: "src-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockSyncLdapSource).toHaveBeenCalledWith("src-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ldap_sync", entityType: "ldapsource", entityId: "src-1" }),
    );
    const body = await response.json();
    expect(body.data.users).toBe(5);
  });

  it("returns 500 with the error message on failure", async () => {
    mockSyncLdapSource.mockRejectedValue(new Error("LDAP unavailable"));
    const response = await syncRoute.POST(
      new Request("http://localhost/api/v1/admin/ldap-sources/src-1/sync", { method: "POST" }),
      { params: Promise.resolve({ id: "src-1" }) },
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("LDAP unavailable");
  });
});
