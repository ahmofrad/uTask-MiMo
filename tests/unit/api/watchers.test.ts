import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/watchers", () => ({
  getWatchers: vi.fn(),
  addWatcher: vi.fn(),
  removeWatcher: vi.fn(),
}));

function makeRequest(method: string): Request {
  return new Request("http://localhost/api/v1/watchers/tasks/t1", { method });
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac");
const { logAudit } = await import("@/lib/audit/log");
const { getWatchers, addWatcher, removeWatcher } = await import("@/lib/watchers");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockGetWatchers = getWatchers as ReturnType<typeof vi.fn>;
const mockAddWatcher = addWatcher as ReturnType<typeof vi.fn>;
const mockRemoveWatcher = removeWatcher as ReturnType<typeof vi.fn>;

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

describe("GET /api/v1/watchers/tasks/[taskId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await GET(makeRequest("GET"), { params: { taskId: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns watchers list", async () => {
    mockGetWatchers.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const { GET } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await GET(makeRequest("GET"), { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(mockGetWatchers).toHaveBeenCalledWith("t1");
  });
});

describe("POST /api/v1/watchers/tasks/[taskId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await POST(makeRequest("POST"), { params: { taskId: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await POST(makeRequest("POST"), { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });

  it("adds current user as watcher and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockAddWatcher.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await POST(makeRequest("POST"), { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    expect(mockAddWatcher).toHaveBeenCalledWith("t1", "user-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "watcher_added", entityType: "watcher", entityId: "t1" }),
    );
  });
});

describe("DELETE /api/v1/watchers/tasks/[taskId]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { DELETE } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { taskId: "t1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { DELETE } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });

  it("removes current user as watcher and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockRemoveWatcher.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/v1/watchers/tasks/[taskId]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    expect(mockRemoveWatcher).toHaveBeenCalledWith("t1", "user-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "watcher_removed", entityType: "watcher", entityId: "t1" }),
    );
  });
});
