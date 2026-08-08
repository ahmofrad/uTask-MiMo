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
  listDepartmentManagerCandidates: mockListCandidates,
}));

import { GET } from "@/app/api/v1/departments/[id]/manager-candidates/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockListCandidates.mockResolvedValue([
    { id: "user-1", displayName: "Alice", email: "alice@example.test" },
  ]);
});

describe("GET /api/v1/departments/[id]/manager-candidates", () => {
  it("returns active LDAP manager candidates", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "department-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockListCandidates).toHaveBeenCalledWith("department-1");
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "user-1", displayName: "Alice", email: "alice@example.test" }],
    });
  });

  it("returns the permission guard response", async () => {
    const denied = new Response(null, { status: 403 });
    mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(denied));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "department-1" }),
    });

    expect(response).toBe(denied);
    expect(mockListCandidates).not.toHaveBeenCalled();
  });
});
