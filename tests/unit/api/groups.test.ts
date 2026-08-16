import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockCan = vi.fn();
const mockGetManagedDepartmentIds = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({ can: mockCan }));
vi.mock("@/lib/departments", () => ({ getManagedDepartmentIds: mockGetManagedDepartmentIds }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/groups", () => ({
  listGroups: vi.fn().mockResolvedValue([
    { id: "group-1", name: "Engineering", source: "ldap", dn: "cn=eng,dc=company,dc=local", lastSyncedAt: null, memberCount: 4, ownerDepartment: null, department: { id: "d1", name: "Engineering" } },
  ]),
  createManualGroup: vi.fn((data: { name: string }) =>
    mockCreate(data),
  ),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findMany: mockFindMany },
    department: { findFirst: mockFindFirst },
  },
}));

const { GET, POST } = await import("@/app/api/v1/groups/route");

function request(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/v1/groups", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockCan.mockResolvedValue(true);
  mockGetManagedDepartmentIds.mockResolvedValue([]);
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue({ id: "00000000-0000-4000-8000-0000000000d1" });
  mockCreate.mockResolvedValue({ id: "group-new", name: "Design Team", source: "manual", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d1" });
});

describe("GET /api/v1/groups", () => {
  it("lists all groups for a global manager", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ name: "Engineering", source: "ldap" });
  });

  it("scopes the list to the manager's department subtree", async () => {
    mockCan.mockResolvedValue(false);
    mockGetManagedDepartmentIds.mockResolvedValue(["00000000-0000-4000-8000-0000000000d1"]);
    mockFindMany.mockResolvedValue([
      { id: "group-1", name: "Engineering", source: "ldap", dn: null, lastSyncedAt: null, _count: { memberships: 2 }, ownerDepartment: null, department: { id: "00000000-0000-4000-8000-0000000000d1", name: "Engineering" } },
    ]);

    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { ownerDepartmentId: { in: ["00000000-0000-4000-8000-0000000000d1"] } },
            { department: { id: { in: ["00000000-0000-4000-8000-0000000000d1"] } } },
          ],
        },
      }),
    );
  });

  it("denies users with no group:manage and no managed departments", async () => {
    mockCan.mockResolvedValue(false);
    mockGetManagedDepartmentIds.mockResolvedValue([]);

    const response = await GET(request("GET"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/v1/groups", () => {
  it("creates a manual group with an owner department", async () => {
    const response = await POST(request("POST", { name: "Design Team", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d1" }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: "group-new", name: "Design Team" });
    expect(mockCreate).toHaveBeenCalledWith({ name: "Design Team", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d1" });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_created", entityType: "group" }),
    );
  });

  it("lets a scoped manager create a group in their department", async () => {
    mockCan.mockResolvedValue(false);
    mockGetManagedDepartmentIds.mockResolvedValue(["00000000-0000-4000-8000-0000000000d1"]);

    const response = await POST(request("POST", { name: "Design Team", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d1" }));
    expect(response.status).toBe(201);
  });

  it("denies a scoped manager creating outside their subtree", async () => {
    mockCan.mockResolvedValue(false);
    mockGetManagedDepartmentIds.mockResolvedValue(["00000000-0000-4000-8000-0000000000d1"]);

    const response = await POST(request("POST", { name: "Design Team", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d9" }));
    expect(response.status).toBe(403);
  });

  it("denies a scoped manager creating a group without an owner department", async () => {
    mockCan.mockResolvedValue(false);
    mockGetManagedDepartmentIds.mockResolvedValue(["d1"]);

    const response = await POST(request("POST", { name: "Design Team" }));
    expect(response.status).toBe(403);
  });

  it("returns 404 for a missing owner department", async () => {
    mockFindFirst.mockResolvedValue(null);

    const response = await POST(request("POST", { name: "Design Team", ownerDepartmentId: "00000000-0000-4000-8000-0000000000d1" }));
    expect(response.status).toBe(404);
  });

  it("validates the body", async () => {
    const response = await POST(request("POST", { name: "" }));
    expect(response.status).toBe(400);
  });

  it("denies access without group:manage permission", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    );
    const response = await POST(request("POST", { name: "Design Team" }));
    expect(response.status).toBe(403);
  });
});
