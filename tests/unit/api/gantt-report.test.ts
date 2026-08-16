import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: vi.fn() }));
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ canProject: mockCanProject }));
const mockBuildGanttReport = vi.fn();
vi.mock("@/lib/gantt/report", () => ({ buildGanttReport: mockBuildGanttReport }));

const { requireAuth } = await import("@/lib/rbac/middleware");
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

function makeRequest(query: string): Request {
  return new Request(`http://localhost/api/v1/reports/gantt?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "user-1" });
  mockCanProject.mockResolvedValue(true);
  mockBuildGanttReport.mockImplementation(async (projectId: string) => ({
    projectId,
    tasks: [],
    links: [],
    criticalChain: [],
    scheduleVersion: 0,
    project: { start: null, end: null },
  }));
});

describe("GET /api/v1/reports/gantt", () => {
  it("returns one report map for multiple projects", async () => {
    const { GET } = await import("@/app/api/v1/reports/gantt/route");
    const projectA = "11111111-1111-4111-8111-111111111111";
    const projectB = "22222222-2222-4222-8222-222222222222";

    const response = await GET(makeRequest(`projectIds=${projectA},${projectB}&include=criticalPath`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty(projectA);
    expect(body.data).toHaveProperty(projectB);
    expect(mockBuildGanttReport).toHaveBeenCalledTimes(2);
    expect(mockBuildGanttReport).toHaveBeenNthCalledWith(1, projectA, true);
    expect(mockBuildGanttReport).toHaveBeenNthCalledWith(2, projectB, true);
  });

  it("accepts deterministic seed project IDs", async () => {
    const { GET } = await import("@/app/api/v1/reports/gantt/route");
    const seededProjectId = "00000000-0000-4000-8000-000000000012";

    const response = await GET(makeRequest(`projectIds=${seededProjectId}`));

    expect(response.status).toBe(200);
    expect(mockBuildGanttReport).toHaveBeenCalledWith(seededProjectId, false);
  });

  it("rejects malformed project IDs before loading reports", async () => {
    const { GET } = await import("@/app/api/v1/reports/gantt/route");

    const response = await GET(makeRequest("projectIds=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(mockBuildGanttReport).not.toHaveBeenCalled();
  });

  it("denies a batch containing a project the user cannot access", async () => {
    mockCanProject.mockResolvedValue(false);
    const { GET } = await import("@/app/api/v1/reports/gantt/route");

    const response = await GET(
      makeRequest("projectIds=11111111-1111-4111-8111-111111111111"),
    );

    expect(response.status).toBe(403);
    expect(mockBuildGanttReport).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
    );
    const { GET } = await import("@/app/api/v1/reports/gantt/route");

    const response = await GET(
      makeRequest("projectIds=11111111-1111-4111-8111-111111111111"),
    );

    expect(response.status).toBe(401);
  });
});
