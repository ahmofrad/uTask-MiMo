import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockCanProject = vi.fn();
const mockCanReadProject = vi.fn();
const mockFindUnique = vi.fn();
const mockLogAudit = vi.fn();
const mockGrantGroupProjectRole = vi.fn();
const mockRevokeGroupProjectRole = vi.fn();
const mockListProjectGroupGrants = vi.fn();
const mockListGroups = vi.fn();
const mockNotifyGroupRoleChange = vi.fn();
const mockProjectFindUnique = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({ canProject: mockCanProject, canReadProject: mockCanReadProject }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/groups", () => ({
  grantGroupProjectRole: mockGrantGroupProjectRole,
  revokeGroupProjectRole: mockRevokeGroupProjectRole,
  listProjectGroupGrants: mockListProjectGroupGrants,
  listGroups: mockListGroups,
}));
vi.mock("@/lib/notifications", () => ({ notifyGroupRoleChange: mockNotifyGroupRoleChange }));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findUnique: mockFindUnique },
    project: { findUnique: mockProjectFindUnique },
  },
}));

const { GET, POST } = await import("@/app/api/v1/projects/[projectId]/group-grants/route");
const { DELETE } = await import("@/app/api/v1/projects/[projectId]/group-grants/[groupId]/route");

function request(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/v1/projects/project-1/group-grants", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const GROUP_UUID = "00000000-0000-4000-8000-00000000c0de";

const projectParams = { params: Promise.resolve({ projectId: "project-1" }) };
const revokeParams = { params: Promise.resolve({ projectId: "project-1", groupId: GROUP_UUID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockCanProject.mockResolvedValue(true);
  mockCanReadProject.mockResolvedValue(true);
  mockFindUnique.mockResolvedValue({ id: GROUP_UUID, name: "Engineering", deletedAt: null });
  mockProjectFindUnique.mockResolvedValue({ name: "Work" });
  mockGrantGroupProjectRole.mockResolvedValue({ projectId: "project-1", groupId: GROUP_UUID, role: "contributor" });
  mockRevokeGroupProjectRole.mockResolvedValue({ projectId: "project-1", groupId: GROUP_UUID, role: "viewer" });
  mockListProjectGroupGrants.mockResolvedValue([
    { groupId: GROUP_UUID, role: "contributor", grantedAt: new Date().toISOString(), memberCount: 4, group: { id: GROUP_UUID, name: "Engineering", source: "ldap" } },
  ]);
  mockListGroups.mockResolvedValue([
    { id: GROUP_UUID, name: "Engineering", source: "ldap", memberCount: 4 },
  ]);
});

describe("GET /api/v1/projects/[projectId]/group-grants", () => {
  it("lists grants for a readable project", async () => {
    const response = await GET(request("GET"), projectParams);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ groupId: GROUP_UUID, role: "contributor", memberCount: 4 });
  });

  it("returns the group list only for users who can assign roles", async () => {
    const response = await GET(request("GET"), projectParams);
    const body = await response.json();
    expect(body.groups).toHaveLength(1);
    expect(mockListGroups).toHaveBeenCalled();

    mockCanProject.mockResolvedValue(false);
    const denied = await GET(request("GET"), projectParams);
    const deniedBody = await denied.json();
    expect(deniedBody.groups).toHaveLength(0);
    expect(mockListGroups).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the project is not readable", async () => {
    mockCanReadProject.mockResolvedValue(false);
    const response = await GET(request("GET"), projectParams);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/projects/[projectId]/group-grants", () => {
  it("grants a group a project role", async () => {
    const response = await POST(request("POST", { groupId: GROUP_UUID, role: "lead" }), projectParams);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ role: "contributor" });
    expect(mockGrantGroupProjectRole).toHaveBeenCalledWith("project-1", GROUP_UUID, "lead", "admin-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_grant_created", entityId: "project-1" }),
    );
  });

  it("notifies the group's members on grant", async () => {
    await POST(request("POST", { groupId: GROUP_UUID, role: "contributor" }), projectParams);
    expect(mockNotifyGroupRoleChange).toHaveBeenCalledWith({
      groupId: GROUP_UUID,
      groupName: "Engineering",
      projectId: "project-1",
      projectName: "Work",
      role: "contributor",
      action: "granted",
    });
  });

  it("skips notifications when the project is missing", async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    await POST(request("POST", { groupId: GROUP_UUID }), projectParams);
    expect(mockNotifyGroupRoleChange).not.toHaveBeenCalled();
  });

  it("defaults to contributor role", async () => {
    await POST(request("POST", { groupId: GROUP_UUID }), projectParams);
    expect(mockGrantGroupProjectRole).toHaveBeenCalledWith("project-1", GROUP_UUID, "contributor", "admin-1");
  });

  it("returns 404 for a missing group", async () => {
    mockFindUnique.mockResolvedValue(null);
    const response = await POST(request("POST", { groupId: GROUP_UUID }), projectParams);
    expect(response.status).toBe(404);
  });

  it("denies without project_role:assign", async () => {
    mockCanProject.mockResolvedValue(false);
    const response = await POST(request("POST", { groupId: GROUP_UUID }), projectParams);
    expect(response.status).toBe(403);
  });

  it("validates the body", async () => {
    const response = await POST(request("POST", { groupId: "not-a-uuid", role: "boss" }), projectParams);
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/projects/[projectId]/group-grants/[groupId]", () => {
  it("revokes a group's role", async () => {
    const response = await DELETE(new Request(`http://localhost/api/v1/projects/project-1/group-grants/${GROUP_UUID}`, { method: "DELETE" }), revokeParams);
    expect(response.status).toBe(200);
    expect(mockRevokeGroupProjectRole).toHaveBeenCalledWith("project-1", GROUP_UUID);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_grant_revoked", entityId: "project-1" }),
    );
  });

  it("notifies the group's members on revoke", async () => {
    await DELETE(new Request(`http://localhost/api/v1/projects/project-1/group-grants/${GROUP_UUID}`, { method: "DELETE" }), revokeParams);
    expect(mockNotifyGroupRoleChange).toHaveBeenCalledWith({
      groupId: GROUP_UUID,
      groupName: "Engineering",
      projectId: "project-1",
      projectName: "Work",
      role: "viewer",
      action: "revoked",
    });
  });

  it("returns 404 when the group has no grant", async () => {
    mockRevokeGroupProjectRole.mockResolvedValue(null);
    const response = await DELETE(new Request(`http://localhost/api/v1/projects/project-1/group-grants/${GROUP_UUID}`, { method: "DELETE" }), revokeParams);
    expect(response.status).toBe(404);
  });

  it("denies without project_role:assign", async () => {
    mockCanProject.mockResolvedValue(false);
    const response = await DELETE(new Request(`http://localhost/api/v1/projects/project-1/group-grants/${GROUP_UUID}`, { method: "DELETE" }), revokeParams);
    expect(response.status).toBe(403);
  });
});
