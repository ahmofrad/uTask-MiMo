import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogAudit = vi.fn();

vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

const mockFindUnique = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockUserUpdateMany = vi.fn();
const mockProjectMemberUpdateMany = vi.fn();
const mockDepartmentUpdate = vi.fn();
const mockGroupUpdate = vi.fn();
const mockMembershipUpsert = vi.fn();
const mockMembershipCreate = vi.fn();
const mockMembershipDelete = vi.fn();
const mockMembershipFindUnique = vi.fn();
const mockGrantUpsert = vi.fn();
const mockGrantDelete = vi.fn();
const mockGrantFindUnique = vi.fn();
const mockGrantFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findUnique: mockFindUnique, update: mockGroupUpdate },
    ldapGroupMembership: {
      findMany: mockMembershipFindMany,
      upsert: mockMembershipUpsert,
      create: mockMembershipCreate,
      delete: mockMembershipDelete,
      findUnique: mockMembershipFindUnique,
    },
    user: { updateMany: mockUserUpdateMany },
    projectMember: { updateMany: mockProjectMemberUpdateMany },
    department: { update: mockDepartmentUpdate },
    projectGroupGrant: {
      upsert: mockGrantUpsert,
      delete: mockGrantDelete,
      findUnique: mockGrantFindUnique,
      findMany: mockGrantFindMany,
    },
  },
}));

const { deleteGroup, addGroupMember, removeGroupMember, grantGroupProjectRole, revokeGroupProjectRole } =
  await import("@/lib/groups");

beforeEach(() => {
  vi.clearAllMocks();
  mockUserUpdateMany.mockResolvedValue({ count: 1 });
  mockProjectMemberUpdateMany.mockResolvedValue({ count: 1 });
  mockDepartmentUpdate.mockResolvedValue({ id: "department-1" });
  mockGroupUpdate.mockResolvedValue({ id: "group-1" });
  mockMembershipUpsert.mockResolvedValue({});
  mockMembershipDelete.mockResolvedValue({});
  mockGrantUpsert.mockResolvedValue({ id: "grant-1", role: "contributor" });
  mockGrantDelete.mockResolvedValue({});
  mockGrantFindMany.mockResolvedValue([]);
});

describe("deleteGroup", () => {
  it("archives the department and disables access only for users with no remaining LDAP membership", async () => {
    mockFindUnique.mockResolvedValue({
      id: "group-1",
      name: "Engineering",
      dn: "cn=engineering,dc=company,dc=local",
      source: "ldap",
      department: { id: "department-1" },
    });
    mockMembershipFindMany
      .mockResolvedValueOnce([{ userId: "user-leaving" }, { userId: "user-still-member" }])
      .mockResolvedValueOnce([{ userId: "user-still-member" }]);

    const result = await deleteGroup("group-1", "admin-1");

    expect(result).toEqual({ usersAffected: 1 });
    expect(mockDepartmentUpdate).toHaveBeenCalledWith({
      where: { id: "department-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["user-leaving"] } },
      data: { status: "ldapGroupRemoved", ldapGroupId: null },
    });
    expect(mockProjectMemberUpdateMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-leaving"] } },
      data: { disabledAt: expect.any(Date), disabledReason: "ldap" },
    });
    expect(mockGroupUpdate).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_deleted", entityId: "group-1" }),
    );
  });

  it("soft-deletes a manual group without disabling users or archiving a department", async () => {
    mockFindUnique.mockResolvedValue({
      id: "group-2",
      name: "Design Team",
      dn: null,
      source: "manual",
      department: null,
    });

    const result = await deleteGroup("group-2", "admin-1");

    expect(result).toEqual({ usersAffected: 0 });
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
    expect(mockProjectMemberUpdateMany).not.toHaveBeenCalled();
    expect(mockDepartmentUpdate).not.toHaveBeenCalled();
    expect(mockGroupUpdate).toHaveBeenCalledWith({
      where: { id: "group-2" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("returns null for a missing group", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await deleteGroup("missing", "admin-1")).toBeNull();
  });
});

describe("member management helpers", () => {
  it("addGroupMember creates a manual membership with null sourceMemberDn", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce(null);
    mockMembershipCreate.mockResolvedValueOnce({
      userId: "user-1",
      ldapSyncGroupId: "group-1",
      sourceMemberDn: null,
    });
    const result = await addGroupMember("group-1", "user-1");
    expect(result.created).toBe(true);
    expect(mockMembershipCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", ldapSyncGroupId: "group-1", sourceMemberDn: null },
    });
  });

  it("addGroupMember reports created:false when the user is already a member", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      ldapSyncGroupId: "group-1",
      sourceMemberDn: null,
    });
    const result = await addGroupMember("group-1", "user-1");
    expect(result.created).toBe(false);
    expect(mockMembershipCreate).not.toHaveBeenCalled();
  });

  it("removeGroupMember deletes an existing membership and returns null otherwise", async () => {
    mockMembershipFindUnique.mockResolvedValueOnce({ userId: "user-1", ldapSyncGroupId: "group-1" });
    expect(await removeGroupMember("group-1", "user-1")).toBeTruthy();
    expect(mockMembershipDelete).toHaveBeenCalledWith({
      where: { userId_ldapSyncGroupId: { userId: "user-1", ldapSyncGroupId: "group-1" } },
    });

    mockMembershipFindUnique.mockResolvedValueOnce(null);
    expect(await removeGroupMember("group-1", "nobody")).toBeNull();
  });
});

describe("project grant helpers", () => {
  it("grantGroupProjectRole upserts with the given role and actor", async () => {
    await grantGroupProjectRole("project-1", "group-1", "lead", "admin-1");
    expect(mockGrantUpsert).toHaveBeenCalledWith({
      where: { projectId_groupId: { projectId: "project-1", groupId: "group-1" } },
      create: { projectId: "project-1", groupId: "group-1", role: "lead", grantedBy: "admin-1" },
      update: { role: "lead" },
    });
  });

  it("revokeGroupProjectRole deletes an existing grant and returns null otherwise", async () => {
    mockGrantFindUnique.mockResolvedValueOnce({ projectId: "project-1", groupId: "group-1", role: "viewer" });
    expect(await revokeGroupProjectRole("project-1", "group-1")).toBeTruthy();
    expect(mockGrantDelete).toHaveBeenCalledWith({
      where: { projectId_groupId: { projectId: "project-1", groupId: "group-1" } },
    });

    mockGrantFindUnique.mockResolvedValueOnce(null);
    expect(await revokeGroupProjectRole("project-1", "group-1")).toBeNull();
  });
});
