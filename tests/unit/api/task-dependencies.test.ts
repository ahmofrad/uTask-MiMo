import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { task: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/tasks", () => ({
  addDependency: vi.fn(),
  listDependencies: vi.fn(),
  DependencyError: class DependencyError extends Error {},
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

const projectId = "11111111-1111-4111-8111-111111111111";
const otherProjectId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";

const { requireAuth } = await import("@/lib/rbac/middleware");
const { canProject } = await import("@/lib/rbac");
const { prisma } = await import("@/lib/db");
const { addDependency, listDependencies } = await import("@/lib/tasks");

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;
const mockCanProject = canProject as ReturnType<typeof vi.fn>;
const mockTaskFindUnique = prisma.task.findUnique as ReturnType<typeof vi.fn>;
const mockAddDependency = addDependency as ReturnType<typeof vi.fn>;
const mockListDependencies = listDependencies as ReturnType<typeof vi.fn>;

function routeParams() {
  return { params: Promise.resolve({ projectId, taskId }) };
}

function request(body?: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "user-1" });
  mockCanProject.mockResolvedValue(true);
  mockTaskFindUnique.mockResolvedValue({ projectId, deletedAt: null });
  mockListDependencies.mockResolvedValue([]);
});

describe("task dependency route isolation", () => {
  it("returns not found when the task is outside the URL project", async () => {
    mockTaskFindUnique.mockResolvedValue({ projectId: otherProjectId, deletedAt: null });
    const { GET } = await import("@/app/api/v1/projects/[projectId]/tasks/[taskId]/dependencies/route");

    const response = await GET(new Request("http://localhost/api"), routeParams());

    expect(response.status).toBe(404);
    expect(mockCanProject).not.toHaveBeenCalled();
    expect(mockListDependencies).not.toHaveBeenCalled();
  });

  it("rejects unknown dependency fields before creating an edge", async () => {
    const { POST } = await import("@/app/api/v1/projects/[projectId]/tasks/[taskId]/dependencies/route");

    const response = await POST(request({ dependsOnId: taskId, unexpected: true }), routeParams());

    expect(response.status).toBe(400);
    expect(mockAddDependency).not.toHaveBeenCalled();
  });
});
