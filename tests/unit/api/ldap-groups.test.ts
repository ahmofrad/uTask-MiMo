import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockUpsert = vi.fn();
const mockEnsureLdapDepartment = vi.fn();
const mockLogAudit = vi.fn();
const mockGetFirstLdapSource = vi.fn();
const mockSourceToLdapConfig = vi.fn();
const mockSourceFindFirst = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { upsert: mockUpsert },
    ldapSource: { findFirst: mockSourceFindFirst },
  },
}));
vi.mock("@/lib/departments", () => ({
  ensureLdapDepartment: mockEnsureLdapDepartment,
}));
vi.mock("@/lib/auth/providers/ldap", () => ({
  searchLdapGroups: vi.fn(),
  syncLdapGroup: vi.fn(),
}));
vi.mock("@/lib/auth/ldap-sources", () => ({
  getFirstLdapSource: mockGetFirstLdapSource,
  sourceToLdapConfig: mockSourceToLdapConfig,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const { POST } = await import("@/app/api/v1/admin/ldap/groups/route");
const { syncLdapGroup } = await import("@/lib/auth/providers/ldap");

const enabledSource = {
  id: "source-1",
  name: "Company Directory",
  enabled: true,
  url: "ldaps://dc.company.local:636",
  bindUpn: "svc@company.local",
  bindPassword: "plain-secret",
  upnSuffix: "@company.local",
  searchBase: "DC=company,DC=local",
  emailAttribute: "mail",
  nameAttribute: "cn",
  defaultRole: "member",
  syncIntervalHours: 12,
  tlsCaCert: null,
  lastSyncedAt: null,
  lastSyncError: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const runtimeConfig = {
  enabled: true,
  url: "ldaps://dc.company.local:636",
  bindUpn: "svc@company.local",
  bindPassword: "plain-secret",
  upnSuffix: "@company.local",
  searchBase: "DC=company,DC=local",
  emailAttribute: "mail",
  nameAttribute: "cn",
  defaultRole: "member",
  syncIntervalHours: 12,
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/admin/ldap/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockGetFirstLdapSource.mockResolvedValue(enabledSource);
  mockSourceToLdapConfig.mockReturnValue(runtimeConfig);
  mockUpsert.mockResolvedValue({
    id: "group-1",
    dn: "cn=engineering,dc=company,dc=local",
    name: "Engineering",
    sourceId: "source-1",
  });
  mockEnsureLdapDepartment.mockResolvedValue({
    department: { id: "department-1", name: "Engineering" },
    created: true,
    renamed: false,
  });
  (syncLdapGroup as ReturnType<typeof vi.fn>).mockResolvedValue(3);
});

describe("POST /api/v1/admin/ldap/groups", () => {
  it("creates the matching department and records the source on the group", async () => {
    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { dn: "cn=engineering,dc=company,dc=local" },
      create: { dn: "cn=engineering,dc=company,dc=local", name: "Engineering", source: "ldap", sourceId: "source-1" },
      update: { name: "Engineering", deletedAt: null, sourceId: "source-1" },
    });
    expect(mockEnsureLdapDepartment).toHaveBeenCalledWith({
      id: "group-1",
      name: "Engineering",
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "department_created",
        entityType: "department",
        entityId: "department-1",
      }),
    );
  });

  it("syncs members immediately against the resolved source's config", async () => {
    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(200);
    expect(syncLdapGroup).toHaveBeenCalledWith(
      runtimeConfig,
      { id: "group-1", dn: "cn=engineering,dc=company,dc=local", name: "Engineering" },
    );
    const body = await response.json();
    expect(body.data.users).toBe(3);
    expect(body.data.sourceId).toBe("source-1");
  });

  it("prefers an explicit sourceId (query param) over the first source", async () => {
    mockSourceFindFirst.mockResolvedValue({ ...enabledSource, id: "source-2" });

    const response = await POST(
      new Request("http://localhost/api/v1/admin/ldap/groups?sourceId=source-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dn: "cn=engineering,dc=company,dc=local", name: "Engineering" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSourceFindFirst).toHaveBeenCalledWith({
      where: { id: "source-2", deletedAt: null },
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sourceId: "source-2" }),
      }),
    );
  });

  it("rejects when LDAP is not configured (no enabled source)", async () => {
    mockGetFirstLdapSource.mockResolvedValue(null);

    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(syncLdapGroup).not.toHaveBeenCalled();
  });
});
