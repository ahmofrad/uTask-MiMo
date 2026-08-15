import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockUpsert = vi.fn();
const mockEnsureLdapDepartment = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: { ldapSyncGroup: { upsert: mockUpsert } },
}));
vi.mock("@/lib/departments", () => ({
  ensureLdapDepartment: mockEnsureLdapDepartment,
}));
vi.mock("@/lib/auth/providers/ldap", () => ({
  getLdapConfig: vi.fn(),
  searchLdapGroups: vi.fn(),
  syncLdapGroup: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const { POST } = await import("@/app/api/v1/admin/ldap/groups/route");
const { getLdapConfig, syncLdapGroup } = await import("@/lib/auth/providers/ldap");

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
  mockUpsert.mockResolvedValue({
    id: "group-1",
    dn: "cn=engineering,dc=company,dc=local",
    name: "Engineering",
  });
  mockEnsureLdapDepartment.mockResolvedValue({
    department: { id: "department-1", name: "Engineering" },
    created: true,
    renamed: false,
  });
});

describe("POST /api/v1/admin/ldap/groups", () => {
  it("creates the matching department when a group is selected", async () => {
    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { dn: "cn=engineering,dc=company,dc=local" },
      create: { dn: "cn=engineering,dc=company,dc=local", name: "Engineering" },
      update: { name: "Engineering", deletedAt: null },
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

  it("syncs members and manager immediately when LDAP is enabled", async () => {
    (getLdapConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true });
    (syncLdapGroup as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(200);
    expect(syncLdapGroup).toHaveBeenCalledWith(
      { enabled: true },
      { id: "group-1", dn: "cn=engineering,dc=company,dc=local", name: "Engineering" },
    );
    const body = await response.json();
    expect(body.data.users).toBe(3);
  });

  it("does not sync when LDAP is disabled", async () => {
    (getLdapConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: false });

    const response = await POST(request({
      dn: "cn=engineering,dc=company,dc=local",
      name: "Engineering",
    }));

    expect(response.status).toBe(200);
    expect(syncLdapGroup).not.toHaveBeenCalled();
  });
});
