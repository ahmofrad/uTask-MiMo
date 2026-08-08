import { beforeEach, describe, expect, it, vi } from "vitest";

const projectId = "00000000-0000-4000-8000-000000000001";
const { mockRequireAuth, mockCanProject, mockListDepartments } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockCanProject: vi.fn(),
  mockListDepartments: vi.fn(),
}));

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({ canProject: mockCanProject }));
vi.mock("@/lib/departments", () => ({ listProjectLinkDepartments: mockListDepartments }));

import { GET } from "@/app/api/v1/departments/for-project-link/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "manager-1" });
  mockCanProject.mockResolvedValue(true);
  mockListDepartments.mockResolvedValue([
    { id: "department-1", name: "Engineering", parentId: null, source: "ldap" },
  ]);
});

describe("GET /api/v1/departments/for-project-link", () => {
  it("returns departments for a project manager", async () => {
    const response = await GET(new Request(`http://localhost?projectId=${projectId}`));

    expect(response.status).toBe(200);
    expect(mockCanProject).toHaveBeenCalledWith("manager-1", "project:update", projectId);
    expect(mockListDepartments).toHaveBeenCalledWith(projectId);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "department-1", name: "Engineering", parentId: null, source: "ldap" }],
    });
  });

  it("denies callers without project update scope", async () => {
    mockCanProject.mockResolvedValue(false);

    const response = await GET(new Request(`http://localhost?projectId=${projectId}`));

    expect(response.status).toBe(403);
    expect(mockListDepartments).not.toHaveBeenCalled();
  });
});
