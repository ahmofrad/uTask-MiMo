import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockRequireAuth, mockCanProject, mockIsProjectOwner, mockPrisma, mockLogAudit } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockCanProject: vi.fn(),
    mockIsProjectOwner: vi.fn(),
    mockPrisma: {
      project: { findUnique: vi.fn(), update: vi.fn() },
    },
    mockLogAudit: vi.fn(),
  }));

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({
  canProject: mockCanProject,
  isProjectOwner: mockIsProjectOwner,
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

import { PUT } from "@/app/api/v1/projects/[projectId]/health/route";

const EXISTING_PROJECT = {
  id: "project-1",
  archivedAt: null,
  ragStatus: "GREEN",
  ragReason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "user-1" });
  mockCanProject.mockResolvedValue(true);
  mockIsProjectOwner.mockResolvedValue(false);
  mockPrisma.project.findUnique.mockResolvedValue(EXISTING_PROJECT);
  mockPrisma.project.update.mockResolvedValue({
    ...EXISTING_PROJECT,
    ragStatus: "AMBER",
    ragReason: "Delayed milestones",
    healthUpdatedAt: new Date("2026-08-20T12:00:00Z"),
  });
  mockLogAudit.mockResolvedValue(undefined);
});

function put(body: unknown): Promise<Response> {
  return PUT(
    new Request("http://localhost/api/v1/projects/project-1/health", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ projectId: "project-1" }) },
  );
}

describe("PUT /api/v1/projects/:id/health", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
    );
    const res = await put({ ragStatus: "AMBER" });
    expect(res.status).toBe(401);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or archived project", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const res = await put({ ragStatus: "AMBER" });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the user cannot update the project", async () => {
    mockCanProject.mockResolvedValue(false);
    mockIsProjectOwner.mockResolvedValue(false);
    const res = await put({ ragStatus: "AMBER" });
    expect(res.status).toBe(403);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it("allows the project owner even without the project:update action", async () => {
    mockCanProject.mockResolvedValue(false);
    mockIsProjectOwner.mockResolvedValue(true);
    const res = await put({ ragStatus: "RED" });
    expect(res.status).toBe(200);
  });

  it("rejects an unknown ragStatus and unknown fields (strict)", async () => {
    const bad1 = await put({ ragStatus: "PURPLE" });
    expect(bad1.status).toBe(400);
    const bad2 = await put({ ragStatus: "AMBER", extra: true });
    expect(bad2.status).toBe(400);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it("persists the status, reason and healthUpdatedAt, and audits the change", async () => {
    const res = await put({ ragStatus: "AMBER", ragReason: "Delayed milestones" });
    expect(res.status).toBe(200);

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: {
        ragStatus: "AMBER",
        ragReason: "Delayed milestones",
        healthUpdatedAt: expect.any(Date),
      },
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        action: "project_health_updated",
        entityType: "project",
        entityId: "project-1",
        before: { ragStatus: "GREEN", ragReason: null },
        after: { ragStatus: "AMBER", ragReason: "Delayed milestones" },
      }),
    );

    const json = await res.json();
    expect(json.data).toEqual({
      ragStatus: "AMBER",
      ragReason: "Delayed milestones",
      healthUpdatedAt: "2026-08-20T12:00:00.000Z",
    });
  });

  it("stores null reason when omitted", async () => {
    mockPrisma.project.update.mockResolvedValue({
      ...EXISTING_PROJECT,
      ragStatus: "RED",
      ragReason: null,
      healthUpdatedAt: new Date("2026-08-20T12:00:00Z"),
    });
    const res = await put({ ragStatus: "RED" });
    expect(res.status).toBe(200);
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ragReason: null }),
      }),
    );
  });
});
