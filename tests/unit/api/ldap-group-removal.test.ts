import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockDeleteGroup = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/groups", () => ({ deleteGroup: mockDeleteGroup }));

const { DELETE } = await import("@/app/api/v1/admin/ldap/groups/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockDeleteGroup.mockResolvedValue({ usersAffected: 1 });
});

describe("DELETE /api/v1/admin/ldap/groups/[id]", () => {
  it("delegates to the shared deleteGroup with the actor user id", async () => {
    const response = await DELETE(new Request("http://localhost"), {
      params: { id: "group-1" },
    });

    expect(response.status).toBe(200);
    expect(mockDeleteGroup).toHaveBeenCalledWith("group-1", "admin-1");
    const body = await response.json();
    expect(body.data).toEqual({ success: true, usersAffected: 1 });
  });

  it("returns 404 when the group does not exist", async () => {
    mockDeleteGroup.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: { id: "missing-group" },
    });

    expect(response.status).toBe(404);
    expect(mockDeleteGroup).toHaveBeenCalledWith("missing-group", "admin-1");
  });

  it("denies access without sso:configure permission", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
      ),
    );

    const response = await DELETE(new Request("http://localhost"), {
      params: { id: "group-1" },
    });

    expect(response.status).toBe(403);
    expect(mockDeleteGroup).not.toHaveBeenCalled();
  });
});
