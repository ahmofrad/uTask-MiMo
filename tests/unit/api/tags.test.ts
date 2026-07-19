import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
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

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/tags", init);
}

const { auth } = await import("@/lib/auth/config");
const { prisma } = await import("@/lib/db");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockTagFindMany = (prisma.tag.findMany as ReturnType<typeof vi.fn>);
const mockTagFindFirst = (prisma.tag.findFirst as ReturnType<typeof vi.fn>);
const mockTagCreate = (prisma.tag.create as ReturnType<typeof vi.fn>);
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

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

describe("POST /api/v1/tags", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/tags/route");
    const res = await POST(makeRequest("POST", { name: "bug" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/tags/route");
    const res = await POST(makeRequest("POST", { name: "bug" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is empty", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/tags/route");
    const res = await POST(makeRequest("POST", { name: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns existing tag on duplicate name", async () => {
    mockCan.mockResolvedValue(true);
    const existing = { id: "tag-1", name: "bug", color: "#ff0000" };
    mockTagFindFirst.mockResolvedValue(existing);

    const { POST } = await import("@/app/api/v1/tags/route");
    const res = await POST(makeRequest("POST", { name: "bug" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(existing);
    expect(mockTagCreate).not.toHaveBeenCalled();
  });

  it("creates tag, logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockTagFindFirst.mockResolvedValue(null);
    mockTagCreate.mockResolvedValue({ id: "tag-2", name: "bug", color: "#ff0000" });

    const { POST } = await import("@/app/api/v1/tags/route");
    const res = await POST(makeRequest("POST", { name: "bug" }));

    expect(res.status).toBe(201);
    expect(mockTagCreate).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "tag" }),
    );
  });
});

describe("GET /api/v1/tags", () => {
  it("returns tag list", async () => {
    mockTagFindMany.mockResolvedValue([{ id: "tag-1", name: "bug" }]);
    const { GET } = await import("@/app/api/v1/tags/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});
