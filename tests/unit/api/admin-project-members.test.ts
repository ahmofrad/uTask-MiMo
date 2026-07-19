import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/db", () => ({
  prisma: {
    projectMember: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/admin/projects/p1/members/u1", init);
}

const { auth } = await import("@/lib/auth/config");
const { logAudit } = await import("@/lib/audit/log");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as {
  projectMember: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "admin-1" } });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("PATCH /api/v1/admin/projects/[id]/members/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "lead" }), {
      params: { id: "p1", userId: "u1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can and canProject both deny", async () => {
    mockCan.mockResolvedValue(false);
    mockCanProject.mockResolvedValue(false);

    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "lead" }), {
      params: { id: "p1", userId: "u1" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when projectRole is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", {}), { params: { id: "p1", userId: "u1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when projectRole is invalid", async () => {
    mockCan.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "owner" }), {
      params: { id: "p1", userId: "u1" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when membership not found", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "lead" }), {
      params: { id: "p1", userId: "u1" },
    });
    expect(res.status).toBe(404);
  });

  it("updates project role and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      projectId: "p1",
      userId: "u1",
      projectRole: "viewer",
    });
    mockPrisma.projectMember.update.mockResolvedValue({});

    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "lead" }), {
      params: { id: "p1", userId: "u1" },
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.projectMember.update).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "p1", userId: "u1" } },
      data: { projectRole: "lead" },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ before: { projectRole: "viewer" }, after: { projectRole: "lead" } }),
    );
  });

  it("allows when can returns true for one permission", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      projectId: "p1",
      userId: "u1",
      projectRole: "viewer",
    });
    mockPrisma.projectMember.update.mockResolvedValue({});

    const { PATCH } = await import("@/app/api/v1/admin/projects/[id]/members/[userId]/route");
    const res = await PATCH(makeRequest("PATCH", { projectRole: "contributor" }), {
      params: { id: "p1", userId: "u1" },
    });

    expect(res.status).toBe(200);
  });
});
