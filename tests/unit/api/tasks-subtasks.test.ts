import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac/can", () => ({ can: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    webhook: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/tasks/t1/subtasks", init);
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac/can");
const { logAudit } = await import("@/lib/audit/log");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as {
  task: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
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

describe("GET /api/v1/tasks/[id]/subtasks", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await GET(makeRequest("GET"), { params: { id: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns subtask list", async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      { id: "t2", title: "Subtask 1", status: "open", priority: "med", assigneeId: null },
    ]);

    const { GET } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await GET(makeRequest("GET"), { params: { id: "t1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Subtask 1");
  });
});

describe("POST /api/v1/tasks/[id]/subtasks", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "Subtask" }), { params: { id: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "Subtask" }), { params: { id: "t1" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", {}), { params: { id: "t1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when title is whitespace only", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "   " }), { params: { id: "t1" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when parent task not found", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.task.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "Subtask" }), { params: { id: "t1" } });
    expect(res.status).toBe(404);
  });

  it("creates subtask and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "p1" });
    mockPrisma.task.create.mockResolvedValue({ id: "t2", title: "Subtask", projectId: "p1" });

    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "Subtask" }), { params: { id: "t1" } });

    expect(res.status).toBe(201);
    expect(mockPrisma.task.create).toHaveBeenCalledWith({
      data: {
        title: "Subtask",
        projectId: "p1",
        parentTaskId: "t1",
        status: "open",
        priority: "med",
        reporterId: "user-1",
        createdById: "user-1",
        orderIndex: 0,
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", entityType: "task" }),
    );
  });

  it("trims title before creating", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "p1" });
    mockPrisma.task.create.mockResolvedValue({ id: "t2", title: "Subtask", projectId: "p1" });

    const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
    const res = await POST(makeRequest("POST", { title: "  Subtask  " }), { params: { id: "t1" } });

    expect(res.status).toBe(201);
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Subtask" }) }),
    );
  });
});
