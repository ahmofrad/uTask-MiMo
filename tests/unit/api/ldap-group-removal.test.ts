import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockFindUnique = vi.fn();
const mockGroupUpdate = vi.fn();
const mockMembershipFindMany = vi.fn();

const mockUserUpdateMany = vi.fn();
const mockProjectMemberUpdateMany = vi.fn();
const mockDepartmentUpdate = vi.fn();
const mockProjectUpdateMany = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findUnique: mockFindUnique, update: mockGroupUpdate },
    ldapGroupMembership: { findMany: mockMembershipFindMany },
    user: { updateMany: mockUserUpdateMany },
    projectMember: { updateMany: mockProjectMemberUpdateMany },
    department: { update: mockDepartmentUpdate },
    project: { updateMany: mockProjectUpdateMany },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const { DELETE } = await import("@/app/api/v1/admin/ldap/groups/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockFindUnique.mockResolvedValue({
    id: "group-1",
    name: "Engineering",
    dn: "cn=engineering,dc=company,dc=local",
    department: { id: "department-1" },
  });
  mockMembershipFindMany.mockResolvedValueOnce([
    { userId: "user-leaving" },
    { userId: "user-still-member" },
  ]).mockResolvedValueOnce([{ userId: "user-still-member" }]);

  mockUserUpdateMany.mockResolvedValue({ count: 1 });
  mockProjectMemberUpdateMany.mockResolvedValue({ count: 1 });
  mockDepartmentUpdate.mockResolvedValue({ id: "department-1", deletedAt: new Date() });
  mockProjectUpdateMany.mockResolvedValue({ count: 1 });
  mockGroupUpdate.mockResolvedValue({ id: "group-1", deletedAt: new Date() });
});

describe("DELETE /api/v1/admin/ldap/groups/[id]", () => {
  it("archives the department and disables access only for users with no remaining LDAP membership", async () => {
    const response = await DELETE(new Request("http://localhost"), {
      params: { id: "group-1" },
    });

    expect(response.status).toBe(200);
    expect(mockDepartmentUpdate).toHaveBeenCalledWith({
      where: { id: "department-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockMembershipFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: { in: ["user-leaving", "user-still-member"] },
        group: { deletedAt: null },
      },
      select: { userId: true },
    });
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["user-leaving"] } },
      data: { status: "ldapGroupRemoved", ldapGroupId: null },
    });
    expect(mockProjectMemberUpdateMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-leaving"] } },
      data: { disabledAt: expect.any(Date), disabledReason: "ldap" },
    });
    expect(mockProjectUpdateMany).not.toHaveBeenCalled();
    expect(mockGroupUpdate).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
