import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ──
vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    taskAssignee: {
      findMany: vi.fn(() => Promise.resolve([])),
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    ldapGroupMembership: { findMany: vi.fn(() => Promise.resolve([])) },
    instanceSetting: { findUnique: vi.fn() },
    taskDependency: { findMany: vi.fn(() => Promise.resolve([])) },
    notification: { create: vi.fn(() => Promise.resolve({})) },
    projectMember: {
      findMany: vi.fn(() => Promise.resolve([])),
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
  },
}));

// ── RBAC mocks ──
vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/rbac", () => ({
  canProject: vi.fn(() => Promise.resolve(true)),
  canReadTask: vi.fn(() => Promise.resolve(true)),
  canEditTask: vi.fn(() => Promise.resolve(true)),
}));

// ── Audit mock ──
vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn(() => Promise.resolve(undefined)),
}));

// ── Webhook mock ──
vi.mock("@/lib/webhook/emit", () => ({
  emitTaskEvent: vi.fn(() => Promise.resolve(undefined)),
}));

// ── Realtime mock ──
vi.mock("@/lib/realtime/server", () => ({
  emitToProject: vi.fn(),
  emitToTask: vi.fn(),
}));

// ── Attachments mock ──
vi.mock("@/lib/attachments", () => ({
  getAttachmentsByTask: vi.fn(() => Promise.resolve([])),
  getPresignedUrl: vi.fn(() => Promise.resolve(null)),
  createAttachment: vi.fn(() => Promise.resolve({ id: "att-1", name: "test.txt" })),
  deleteAttachment: vi.fn(() => Promise.resolve(undefined)),
  updateAttachment: vi.fn(() => Promise.resolve({ id: "att-1", name: "renamed.txt" })),
}));

// ── Task helpers mock ──
vi.mock("@/lib/tasks", () => ({
  getTaskById: vi.fn(),
  moveTask: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  deleteTask: vi.fn(),
  toPlainTaskRow: vi.fn((t: Record<string, unknown>) => t),
  isTaskFinalizer: vi.fn(() => Promise.resolve(true)),
  TaskNotPendingApprovalError: class extends Error { code = "NOT_PENDING_APPROVAL"; },
  WbsGuardError: class extends Error { code: string; constructor(c: string, m: string) { super(m); this.code = c; } },
  DependencyBlockedError: class extends Error { message: string; blockers: unknown; constructor(m: string, b: unknown) { super(m); this.message = m; this.blockers = b; } },
}));

// ── Comments mock ──
vi.mock("@/lib/comments", () => ({
  getTaskComments: vi.fn(() => Promise.resolve([])),
  createComment: vi.fn(() => Promise.resolve({ id: "c1", bodyMarkdown: "hi", author: { displayName: "Test" } })),
}));

// ── Mentions mock ──
vi.mock("@/lib/mentions", () => ({
  parseMentions: vi.fn(() => []),
  resolveMentionTarget: vi.fn(() => Promise.resolve(null)),
}));

// ── Notifications mock ──
vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(() => Promise.resolve(undefined)),
}));

// ── Watchers mock ──
vi.mock("@/lib/watchers", () => ({
  ensureWatcher: vi.fn(() => Promise.resolve(undefined)),
}));

// ── Idempotency mock ──
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => Promise.resolve({ hit: false, conflict: false, unavailable: false })),
  setIdempotencyResult: vi.fn(() => Promise.resolve(undefined)),
  acquirePending: vi.fn(() => Promise.resolve("acquired")),
  releasePending: vi.fn(() => Promise.resolve(undefined)),
}));

// ── Crypto mock ──
vi.mock("@/lib/crypto", () => ({
  sha256: vi.fn((s: string) => `hash:${s}`),
}));

// ── Validation mocks ──
vi.mock("@/lib/validation/api", () => ({
  readJsonBody: vi.fn(async (req: Request) => {
    try { return await req.json(); } catch { return null; }
  }),
  subtaskCreateSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d })) },
  subtaskUpdateSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d })) },
  attachmentUpdateSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d })) },
  moveTaskSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d })) },
  approvalDecisionSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d ?? {} })) },
  commentCreateSchema: { safeParse: vi.fn((d: unknown) => ({ success: true, data: d })) },
  validationError: vi.fn((e: unknown) => ({ error: { code: "VALIDATION_ERROR", message: String(e) } })),
}));

vi.mock("@/lib/logging", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Serialize mock ──
vi.mock("@/lib/tasks/serialize", () => ({
  mapAssignees: vi.fn((a: unknown[]) => a),
}));

// ── Custom fields mock ──
vi.mock("@/lib/custom-fields/values", () => ({
  getCustomFieldValuesForTask: vi.fn(() => Promise.resolve({})),
}));

// ── Imported mocks (after vi.mock calls) ──
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask, canEditTask } from "@/lib/rbac";
import {
  getTaskById,
  moveTask,
  approveTask,
  rejectTask,
  deleteTask,
  toPlainTaskRow,
  isTaskFinalizer,
} from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getAttachmentsByTask, createAttachment, deleteAttachment, updateAttachment } from "@/lib/attachments";

// ── Helpers ──
function mockAuth(userId = "user-1") {
  vi.mocked(requireAuth).mockResolvedValue({
    userId,
    session: { user: { id: userId } },
  } as never);
}

function jsonBody(res: Response) {
  return res.json() as Promise<{ data?: unknown; error?: { code: string } }>;
}

// ────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────

describe("Task sub-routes — unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    // Re-set RBAC defaults (clearAllMocks resets vi.mock implementations)
    vi.mocked(canProject).mockResolvedValue(true);
    vi.mocked(canReadTask).mockResolvedValue(true);
    vi.mocked(canEditTask).mockResolvedValue(true);
  });

  // ── POST /tasks/[id]/subtasks ──
  describe("POST /tasks/[id]/subtasks", () => {
    it("creates a subtask and returns 201", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "parent-1", projectId: "proj-1", deletedAt: null } as never);
      vi.mocked(prisma.task.create).mockResolvedValue({ id: "sub-1", title: "Subtask", status: "open" } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ title: "Subtask" }) });
      const res = await POST(req, { params: Promise.resolve({ id: "parent-1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(201);
      expect(json.data).toBeDefined();
    });

    it("returns 404 for missing parent", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const { POST } = await import("@/app/api/v1/tasks/[id]/subtasks/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ title: "X" }) });
      const res = await POST(req, { params: Promise.resolve({ id: "missing" }) });

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /tasks/[id]/subtasks/[subtaskId] ──
  describe("PATCH /tasks/[id]/subtasks/[subtaskId]", () => {
    it("updates a subtask status", async () => {
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce({ id: "parent-1", projectId: "proj-1", deletedAt: null } as never)
        .mockResolvedValueOnce({ id: "sub-1", deletedAt: null, parentTaskId: "parent-1" } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({ id: "sub-1", status: "done" } as never);

      const { PATCH } = await import("@/app/api/v1/tasks/[id]/subtasks/[subtaskId]/route");
      const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "done" }) });
      const res = await PATCH(req, { params: Promise.resolve({ id: "parent-1", subtaskId: "sub-1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });

    it("returns 404 when subtask does not belong to parent", async () => {
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce({ id: "parent-1", projectId: "proj-1", deletedAt: null } as never)
        .mockResolvedValueOnce({ id: "sub-2", deletedAt: null, parentTaskId: "other-parent" } as never);

      const { PATCH } = await import("@/app/api/v1/tasks/[id]/subtasks/[subtaskId]/route");
      const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "done" }) });
      const res = await PATCH(req, { params: Promise.resolve({ id: "parent-1", subtaskId: "sub-2" }) });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /tasks/[id]/subtasks/[subtaskId] ──
  describe("DELETE /tasks/[id]/subtasks/[subtaskId]", () => {
    it("soft-deletes a subtask", async () => {
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce({ id: "p1", projectId: "proj-1", deletedAt: null } as never)
        .mockResolvedValueOnce({ id: "s1", deletedAt: null, parentTaskId: "p1" } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({ id: "s1", deletedAt: new Date() } as never);

      const { DELETE } = await import("@/app/api/v1/tasks/[id]/subtasks/[subtaskId]/route");
      const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "p1", subtaskId: "s1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ success: true });
    });
  });

  // ── GET /tasks/[id]/attachments ──
  describe("GET /tasks/[id]/attachments", () => {
    it("returns attachments list", async () => {
      const { GET } = await import("@/app/api/v1/tasks/[id]/attachments/route");
      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual([]);
    });
  });

  // ── POST /tasks/[id]/move ──
  describe("POST /tasks/[id]/move", () => {
    it("moves a task to a new parent", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "t1", projectId: "proj-1", deletedAt: null } as never);
      vi.mocked(moveTask).mockResolvedValue({ before: {}, task: { id: "t1", parentTaskId: "new-parent" } } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/move/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ newParentId: "new-parent" }) });
      const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });

    it("returns 404 for missing task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const { POST } = await import("@/app/api/v1/tasks/[id]/move/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({}) });
      const res = await POST(req, { params: Promise.resolve({ id: "missing" }) });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /tasks/[id]/approve ──
  describe("POST /tasks/[id]/approve", () => {
    it("approves a pending task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "t1", status: "pending_approval", projectId: "proj-1",
        deletedAt: null, approverId: "user-1",
      } as never);
      vi.mocked(approveTask).mockResolvedValue({ before: {}, task: { id: "t1", status: "done" } } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/approve/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });

    it("returns 409 for non-pending task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "t1", status: "open", projectId: "proj-1",
        deletedAt: null, approverId: null,
      } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/approve/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(409);
    });

    it("returns 403 for non-approver", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "t1", status: "pending_approval", projectId: "proj-1",
        deletedAt: null, approverId: "other-user",
      } as never);
      vi.mocked(isTaskFinalizer).mockResolvedValue(false);

      const { POST } = await import("@/app/api/v1/tasks/[id]/approve/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /tasks/[id]/reject ──
  describe("POST /tasks/[id]/reject", () => {
    it("rejects with a reason", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "t1", status: "pending_approval", projectId: "proj-1",
        deletedAt: null, approverId: "user-1",
      } as never);
      vi.mocked(isTaskFinalizer).mockResolvedValue(true);
      vi.mocked(rejectTask).mockResolvedValue({ before: {}, task: { id: "t1", status: "open" } } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/reject/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Needs work" }) });
      const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });

    it("returns 400 when rejection reason is missing", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "t1", status: "pending_approval", projectId: "proj-1",
        deletedAt: null, approverId: "user-1",
      } as never);
      vi.mocked(isTaskFinalizer).mockResolvedValue(true);

      const { POST } = await import("@/app/api/v1/tasks/[id]/reject/route");
      const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({}) });
      const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /tasks/[id]/restore ──
  describe("POST /tasks/[id]/restore", () => {
    it("restores a soft-deleted task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "t1", projectId: "proj-1", deletedAt: new Date() } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({ id: "t1", deletedAt: null } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/restore/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ success: true, restored: true });
    });

    it("returns success but restored=false for non-deleted task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "t1", projectId: "proj-1", deletedAt: null } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/restore/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ success: true, restored: false });
    });

    it("returns 404 for missing task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const { POST } = await import("@/app/api/v1/tasks/[id]/restore/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) });

      expect(res.status).toBe(404);
    });

    it("returns 403 for non-admin user", async () => {
      vi.mocked(canProject).mockResolvedValue(false);
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "t1", projectId: "proj-1", deletedAt: new Date() } as never);

      const { POST } = await import("@/app/api/v1/tasks/[id]/restore/route");
      const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /tasks/[id] ──
  describe("GET /tasks/[id]", () => {
    it("returns 404 for missing task", async () => {
      vi.mocked(getTaskById).mockResolvedValue(null);

      const { GET } = await import("@/app/api/v1/tasks/[id]/route");
      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) });

      expect(res.status).toBe(404);
    });

    it("returns 404 for unauthorized task", async () => {
      vi.mocked(canReadTask).mockResolvedValue(false);
      vi.mocked(getTaskById).mockResolvedValue({ id: "t1", assignees: [], subtasks: [] } as never);

      const { GET } = await import("@/app/api/v1/tasks/[id]/route");
      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /tasks/[id] ──
  describe("DELETE /tasks/[id]", () => {
    it("soft-deletes a task", async () => {
      vi.mocked(canEditTask).mockResolvedValue(true);
      vi.mocked(deleteTask).mockResolvedValue({ before: { id: "t1", projectId: "proj-1" } } as never);

      const { DELETE } = await import("@/app/api/v1/tasks/[id]/route");
      const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ success: true });
    });
  });

  // ── GET /tasks/[id]/comments ──
  describe("GET /tasks/[id]/comments", () => {
    it("returns comments list", async () => {
      vi.mocked(getTaskById).mockResolvedValue({ id: "t1", title: "Task", assignees: [], projectId: "proj-1" } as never);
      vi.mocked(canProject).mockResolvedValue(true);
      const { GET } = await import("@/app/api/v1/tasks/[id]/comments/route");
      const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual([]);
    });
  });

  // ── POST /tasks/[id]/comments ──
  describe("POST /tasks/[id]/comments", () => {
    it("creates a comment with idempotency key", async () => {
      vi.mocked(getTaskById).mockResolvedValue({ id: "t1", title: "Task", assignees: [], projectId: "proj-1" } as never);
      vi.mocked(canProject).mockResolvedValue(true);

      const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "idempotency-key": "ik-1" },
        body: JSON.stringify({ bodyMarkdown: "Hello" }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
      const json = await jsonBody(res);

      expect(res.status).toBe(201);
      expect(json.data).toBeDefined();
    });

    it("returns 400 when idempotency key is missing", async () => {
      vi.mocked(getTaskById).mockResolvedValue({ id: "t1", title: "Task", assignees: [], projectId: "proj-1" } as never);
      vi.mocked(canProject).mockResolvedValue(true);

      const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ bodyMarkdown: "Hello" }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /tasks/[id]/attachments/[attachmentId] ──
  describe("DELETE /tasks/[id]/attachments/[attachmentId]", () => {
    it("deletes an attachment", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({ id: "t1", projectId: "proj-1", deletedAt: null } as never);
      const { DELETE } = await import("@/app/api/v1/tasks/[id]/attachments/[attachmentId]/route");
      const res = await DELETE(new Request("http://localhost"), {
        params: Promise.resolve({ id: "t1", attachmentId: "att-1" }),
      });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ success: true });
    });
  });

  // ── PATCH /tasks/[id]/attachments/[attachmentId] ──
  describe("PATCH /tasks/[id]/attachments/[attachmentId]", () => {
    it("renames an attachment", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({ id: "t1", projectId: "proj-1", deletedAt: null } as never);
      const { PATCH } = await import("@/app/api/v1/tasks/[id]/attachments/[attachmentId]/route");
      const req = new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "renamed.txt" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "t1", attachmentId: "att-1" }),
      });
      const json = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
    });
  });
});
