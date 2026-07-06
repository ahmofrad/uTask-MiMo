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
vi.mock("@/lib/notifications", () => ({
  markAllAsRead: vi.fn(),
}));

function makeRequest(method: string): Request {
  return new Request("http://localhost/api/v1/notifications/read-all", { method });
}

const { auth } = await import("@/lib/auth/config");
const { markAllAsRead } = await import("@/lib/notifications");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockMarkAllAsRead = markAllAsRead as ReturnType<typeof vi.fn>;

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

describe("POST /api/v1/notifications/read-all", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/notifications/read-all/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read", async () => {
    mockMarkAllAsRead.mockResolvedValue({ count: 5 });

    const { POST } = await import("@/app/api/v1/notifications/read-all/route");
    const res = await POST();

    expect(res.status).toBe(200);
    expect(mockMarkAllAsRead).toHaveBeenCalledWith("user-1");
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });
});
