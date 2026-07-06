import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
}));
vi.mock("@/lib/comments", () => ({
  getTaskComments: vi.fn(),
  createComment: vi.fn(),
}));
vi.mock("@/lib/watchers", () => ({
  ensureWatcher: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/tasks/t1/comments", init);
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac");
const { getTaskComments, createComment } = await import("@/lib/comments");
const { logAudit } = await import("@/lib/audit/log");
const { emitTaskEvent } = await import("@/lib/webhook/emit");
const { ensureWatcher } = await import("@/lib/watchers");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockGetTaskComments = getTaskComments as ReturnType<typeof vi.fn>;
const mockCreateComment = createComment as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockEmitTaskEvent = emitTaskEvent as ReturnType<typeof vi.fn>;
const mockEnsureWatcher = ensureWatcher as ReturnType<typeof vi.fn>;

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

describe("POST /api/v1/tasks/[id]/comments", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
    const res = await POST(makeRequest("POST", { bodyMarkdown: "Hi" }), { params: { id: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
    const res = await POST(makeRequest("POST", { bodyMarkdown: "Hi" }), { params: { id: "t1" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 when bodyMarkdown is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
    const res = await POST(makeRequest("POST", {}), { params: { id: "t1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates comment, logs audit, and emits event", async () => {
    mockCan.mockResolvedValue(true);
    mockCreateComment.mockResolvedValue({ id: "c1", bodyMarkdown: "Hi" });

    const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
    const res = await POST(makeRequest("POST", { bodyMarkdown: "Hi" }), { params: { id: "t1" } });

    expect(res.status).toBe(201);
    expect(mockCreateComment).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment_created", entityType: "comment" }),
    );
    expect(mockEmitTaskEvent).toHaveBeenCalledWith("comment.created", "t1", expect.anything(), "user-1");
  });

  it("auto-watches the task after commenting", async () => {
    mockCan.mockResolvedValue(true);
    mockCreateComment.mockResolvedValue({ id: "c1", bodyMarkdown: "Hi" });

    const { POST } = await import("@/app/api/v1/tasks/[id]/comments/route");
    await POST(makeRequest("POST", { bodyMarkdown: "Hi" }), { params: { id: "t1" } });

    expect(mockEnsureWatcher).toHaveBeenCalledWith("t1", "user-1");
  });
});
