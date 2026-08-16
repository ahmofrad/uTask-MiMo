import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockSyncLdapSource = vi.fn();
const mockSyncAllLdapSources = vi.fn();
const mockSourceFindFirst = vi.fn();
const mockGetEnabledLdapSources = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: { ldapSource: { findFirst: mockSourceFindFirst } },
}));
vi.mock("@/lib/auth/providers/ldap", () => ({
  syncLdapSource: mockSyncLdapSource,
  syncAllLdapSources: mockSyncAllLdapSources,
}));
vi.mock("@/lib/auth/ldap-sources", () => ({
  getEnabledLdapSources: mockGetEnabledLdapSources,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const { POST } = await import("@/app/api/v1/admin/ldap/sync/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/admin/ldap/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockSyncLdapSource.mockResolvedValue({ groups: 2, users: 5 });
  mockSyncAllLdapSources.mockResolvedValue({ sources: 1, groups: 2, users: 5 });
});

describe("POST /api/v1/admin/ldap/sync", () => {
  it("syncs a single source by sourceId", async () => {
    mockSourceFindFirst.mockResolvedValue({ id: "source-1", enabled: true });

    const response = await POST(request({ sourceId: "source-1" }));

    expect(response.status).toBe(200);
    expect(mockSyncLdapSource).toHaveBeenCalledWith("source-1");
    expect(mockSyncAllLdapSources).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ldap_sync",
        entityType: "ldapgroup",
        entityId: "source-1",
      }),
    );
  });

  it("rejects an unknown sourceId", async () => {
    mockSourceFindFirst.mockResolvedValue(null);

    const response = await POST(request({ sourceId: "missing" }));

    expect(response.status).toBe(404);
    expect(mockSyncLdapSource).not.toHaveBeenCalled();
  });

  it("rejects a disabled sourceId", async () => {
    mockSourceFindFirst.mockResolvedValue({ id: "source-1", enabled: false });

    const response = await POST(request({ sourceId: "source-1" }));

    expect(response.status).toBe(400);
    expect(mockSyncLdapSource).not.toHaveBeenCalled();
  });

  it("syncs all sources when no sourceId is given", async () => {
    mockGetEnabledLdapSources.mockResolvedValue([{ id: "source-1" }, { id: "source-2" }]);

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(mockSyncAllLdapSources).toHaveBeenCalled();
    expect(mockSyncLdapSource).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.data.sources).toBe(1);
  });

  it("rejects when no enabled source exists", async () => {
    mockGetEnabledLdapSources.mockResolvedValue([]);

    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(mockSyncAllLdapSources).not.toHaveBeenCalled();
  });
});
