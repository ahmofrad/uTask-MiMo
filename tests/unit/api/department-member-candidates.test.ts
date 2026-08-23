import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockRequirePermission, mockListCandidates } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListCandidates: vi.fn(),
}));

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/departments", () => ({
  listDepartmentMemberCandidates: mockListCandidates,
}));

describe("GET /api/v1/departments/member-candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
    mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
    mockListCandidates.mockResolvedValue([
      { id: "user-1", displayName: "Alice", email: "alice@example.test" },
    ]);
  });

  it("returns eligible candidates", async () => {
    const { GET } = await import("@/app/api/v1/departments/member-candidates/route");
    const response = await GET(new Request("http://localhost/api/v1/departments/member-candidates"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "user-1", displayName: "Alice", email: "alice@example.test" }],
    });
  });

  it("returns the permission guard response", async () => {
    const denied = new Response(null, { status: 403 });
    mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(denied));
    const { GET } = await import("@/app/api/v1/departments/member-candidates/route");
    const response = await GET(new Request("http://localhost/api/v1/departments/member-candidates"));
    expect(response).toBe(denied);
    expect(mockListCandidates).not.toHaveBeenCalled();
  });
});
