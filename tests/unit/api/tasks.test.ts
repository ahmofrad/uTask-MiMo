import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/projects/queries", () => ({ getUserReadableProjectIds: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    projectMember: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
  acquirePending: vi.fn().mockResolvedValue("acquired"),
  releasePending: vi.fn(),
}));
vi.mock("@/lib/tasks", () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "idempotency-key": "test-key" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/tasks", init);
}

const { auth } = await import("@/lib/auth/config");
const { canProject } = await import("@/lib/rbac");
const { listTasks, createTask } = await import("@/lib/tasks");
const { logAudit } = await import("@/lib/audit/log");
const { emitTaskEvent } = await import("@/lib/webhook/emit");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCanProject = canProject as ReturnType<typeof vi.fn>;
const mockListTasks = listTasks as ReturnType<typeof vi.fn>;
const mockCreateTask = createTask as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockEmitTaskEvent = emitTaskEvent as ReturnType<typeof vi.fn>;

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

describe("POST /api/v1/tasks", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/tasks/route");
    const res = await POST(makeRequest("POST", { projectId: "11111111-1111-4111-8111-111111111111", title: "Task" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when projectId is missing", async () => {
    const { POST } = await import("@/app/api/v1/tasks/route");
    const res = await POST(makeRequest("POST", { title: "Task" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("@/app/api/v1/tasks/route");
    const res = await POST(makeRequest("POST", { projectId: "11111111-1111-4111-8111-111111111111" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when canProject denies", async () => {
    mockCanProject.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/tasks/route");
    const res = await POST(makeRequest("POST", { projectId: "11111111-1111-4111-8111-111111111111", title: "Task" }));
    expect(res.status).toBe(403);
  });

  it("creates task, logs audit, and emits event", async () => {
    mockCanProject.mockResolvedValue(true);
    mockCreateTask.mockResolvedValue({ id: "t1", title: "Task", projectId: "11111111-1111-4111-8111-111111111111" });

    const { POST } = await import("@/app/api/v1/tasks/route");
    const res = await POST(makeRequest("POST", { projectId: "11111111-1111-4111-8111-111111111111", title: "Task" }));

    expect(res.status).toBe(201);
    expect(mockCreateTask).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "task_created", entityType: "task" }),
    );
    expect(mockEmitTaskEvent).toHaveBeenCalledWith("task.created", "t1", expect.anything(), "user-1");
  });
});

describe("GET /api/v1/tasks", () => {
  it("returns task list", async () => {
    mockListTasks.mockResolvedValue({ data: [], nextCursor: null });
    const { GET } = await import("@/app/api/v1/tasks/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/tasks/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });
});
