import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    projectMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
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
  return new Request("http://localhost/api/v1/projects/p1/members", init);
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac");
const { logAudit } = await import("@/lib/audit/log");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as {
  projectMember: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("GET /api/v1/projects/[id]/members", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await GET(makeRequest("GET"), { params: { id: "p1" } });
    expect(res.status).toBe(401);
  });

  it("returns member list", async () => {
    mockPrisma.projectMember.findMany.mockResolvedValue([
      { projectId: "p1", userId: "u1", user: { id: "u1", displayName: "A", email: "a@b.com", avatarUrl: null } },
    ]);

    const { GET } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await GET(makeRequest("GET"), { params: { id: "p1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/v1/projects/[id]/members", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await POST(makeRequest("POST", { userId: "u1" }), { params: { id: "p1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await POST(makeRequest("POST", { userId: "u1" }), { params: { id: "p1" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await POST(makeRequest("POST", {}), { params: { id: "p1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("adds member and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.create.mockResolvedValue({
      projectId: "p1",
      userId: "u1",
      projectRole: "contributor",
      addedBy: "user-1",
    });

    const { POST } = await import("@/app/api/v1/projects/[id]/members/route");
    const res = await POST(makeRequest("POST", { userId: "u1", projectRole: "contributor" }), {
      params: { id: "p1" },
    });

    expect(res.status).toBe(201);
    expect(mockPrisma.projectMember.create).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_member_added" }),
    );
  });
});

describe("DELETE /api/v1/projects/[id]/members/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { DELETE } = await import("@/app/api/v1/projects/[id]/members/[userId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "p1", userId: "u1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can and canProject both deny", async () => {
    mockCan.mockResolvedValue(false);
    const { canProject } = await import("@/lib/rbac");
    const mockCanProject = canProject as ReturnType<typeof vi.fn>;
    mockCanProject.mockResolvedValue(false);

    const { DELETE } = await import("@/app/api/v1/projects/[id]/members/[userId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "p1", userId: "u1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when membership not found", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/v1/projects/[id]/members/[userId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "p1", userId: "u1" } });
    expect(res.status).toBe(404);
  });

  it("removes member and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      projectId: "p1",
      userId: "u1",
      projectRole: "contributor",
    });
    mockPrisma.projectMember.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/v1/projects/[id]/members/[userId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "p1", userId: "u1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.projectMember.delete).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_member_removed" }),
    );
  });
});
