import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findUnique: mockFindUnique },
    ldapGroupMembership: { findMany: mockFindMany },
  },
}));

const { GET } = await import("@/app/api/v1/admin/ldap/groups/[id]/members/route");

function request(id: string): Request {
  return new Request(`http://localhost/api/v1/admin/ldap/groups/${id}/members`);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
});

describe("GET /api/v1/admin/ldap/groups/[id]/members", () => {
  it("returns members of an existing group sorted by display name", async () => {
    mockFindUnique.mockResolvedValue({ id: "group-1", deletedAt: null });
    // Prisma applies the orderBy; the route passes the rows through as-is.
    mockFindMany.mockResolvedValue([
      {
        user: { id: "user-2", displayName: "Jane Doe", email: "jane@company.local" },
      },
      {
        user: { id: "user-1", displayName: "John Smith", email: "john@company.local" },
      },
    ]);

    const response = await GET(request("group-1"), params("group-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([
      { id: "user-2", displayName: "Jane Doe", email: "jane@company.local" },
      { id: "user-1", displayName: "John Smith", email: "john@company.local" },
    ]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ldapSyncGroupId: "group-1" },
      select: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { user: { displayName: "asc" } },
    });
  });

  it("returns an empty list for a group without members", async () => {
    mockFindUnique.mockResolvedValue({ id: "group-1", deletedAt: null });
    mockFindMany.mockResolvedValue([]);

    const response = await GET(request("group-1"), params("group-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });

  it("returns 404 for a missing or archived group", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(request("group-1"), params("group-1"));

    expect(response.status).toBe(404);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("denies access without sso:configure permission", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(
        NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
      ),
    );

    const response = await GET(request("group-1"), params("group-1"));

    expect(response.status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
