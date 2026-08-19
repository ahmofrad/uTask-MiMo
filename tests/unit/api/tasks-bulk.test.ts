import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ canEditTask: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/tasks", () => ({
  updateTask: vi.fn(),
  DependencyBlockedError: class DependencyBlockedError extends Error {
    readonly blockers: unknown;
    constructor(message: string) {
      super(message);
      this.blockers = [];
    }
  },
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/tasks/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const { auth } = await import("@/lib/auth/config");
const { canEditTask } = await import("@/lib/rbac");
const { updateTask, DependencyBlockedError } = await import("@/lib/tasks");
const { logAudit } = await import("@/lib/audit/log");
const { emitTaskEvent } = await import("@/lib/webhook/emit");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCanEditTask = canEditTask as ReturnType<typeof vi.fn>;
const mockUpdateTask = updateTask as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockEmitTaskEvent = emitTaskEvent as ReturnType<typeof vi.fn>;

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
  mockCanEditTask.mockResolvedValue(true);
  mockUpdateTask.mockResolvedValue({ before: {}, task: {}, autoScheduled: [] });
});

describe("POST /api/v1/tasks/bulk", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [UUID_A], patch: { status: "done" } }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when taskIds or patch are invalid", async () => {
    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [], patch: { status: "done" } }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when any task is not editable (default-deny)", async () => {
    mockCanEditTask.mockImplementation(async (_userId: string, taskId: string) => taskId === UUID_A);
    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [UUID_A, UUID_B], patch: { status: "done" } }));
    expect(res.status).toBe(403);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("applies the patch to every task and writes a single audit entry", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: UUID_A, title: "Task A", projectId: "project-1" },
      { id: UUID_B, title: "Task B", projectId: "project-1" },
    ]);

    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [UUID_A, UUID_B], patch: { status: "done" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ updated: 2, failed: [], taskIds: [UUID_A, UUID_B] });

    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(mockUpdateTask).toHaveBeenCalledWith(UUID_A, { status: "done" }, "user-1");
    expect(mockUpdateTask).toHaveBeenCalledWith(UUID_B, { status: "done" }, "user-1");

    // One audit entry for the whole bulk operation.
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "task_updated",
        entityType: "task",
        entityId: `${UUID_A},${UUID_B}`,
        actorUserId: "user-1",
        after: expect.objectContaining({ updated: [UUID_A, UUID_B], failed: [] }),
      }),
    );

    // Realtime + webhook events per changed task.
    expect(mockEmitTaskEvent).toHaveBeenCalledTimes(2);
  });

  it("keeps applying the rest when one task is dependency-blocked", async () => {
    mockUpdateTask.mockImplementation(async (id: string) => {
      if (id === UUID_B) throw new DependencyBlockedError("Blocked by dependency");
      return { before: {}, task: {}, autoScheduled: [] };
    });
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: UUID_A, title: "Task A", projectId: "project-1" },
    ]);

    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [UUID_A, UUID_B], patch: { status: "done" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ updated: 1, failed: [{ taskId: UUID_B, code: "DEPENDENCY_BLOCKED" }], taskIds: [UUID_A] });
  });

  it("converts assigneeId to assigneeIds like the single-task route", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: UUID_A, title: "Task A", projectId: "project-1" },
    ]);

    const { POST } = await import("@/app/api/v1/tasks/bulk/route");
    const res = await POST(makeRequest({ taskIds: [UUID_A], patch: { assigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } }));

    expect(res.status).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      UUID_A,
      { assigneeIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] },
      "user-1",
    );
  });
});
