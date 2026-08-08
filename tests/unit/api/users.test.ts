import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    role: { create: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/users", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  suspendUser: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/users", init);
}

const { auth } = await import("@/lib/auth/config");
const { listUsers, createUser, getUserById, suspendUser } = await import("@/lib/users");
const { logAudit } = await import("@/lib/audit/log");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockListUsers = listUsers as ReturnType<typeof vi.fn>;
const mockCreateUser = createUser as ReturnType<typeof vi.fn>;
const mockGetUserById = getUserById as ReturnType<typeof vi.fn>;
const mockSuspendUser = suspendUser as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }; role: { create: ReturnType<typeof vi.fn> } };

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

describe("GET /api/v1/users", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/users/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { GET } = await import("@/app/api/v1/users/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("returns user list", async () => {
    mockCan.mockResolvedValue(true);
    mockListUsers.mockResolvedValue({ data: [{ id: "u1", email: "a@b.com" }], nextCursor: null });

    const { GET } = await import("@/app/api/v1/users/route");
    const res = await GET(makeRequest("GET"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/v1/users", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/users/route");
    const res = await POST(makeRequest("POST", { email: "a@b.com", displayName: "A" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/users/route");
    const res = await POST(makeRequest("POST", { email: "a@b.com", displayName: "A" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when email or displayName is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/users/route");
    const res = await POST(makeRequest("POST", { email: "a@b.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when email already exists", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const { POST } = await import("@/app/api/v1/users/route");
    const res = await POST(makeRequest("POST", { email: "a@b.com", displayName: "A" }));
    expect(res.status).toBe(409);
  });

  it("creates user, optionally creates role, and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: "u1", email: "a@b.com", displayName: "A", status: "active" });

    const { POST } = await import("@/app/api/v1/users/route");
    const res = await POST(makeRequest("POST", { email: "a@b.com", displayName: "A", role: "admin" }));

    expect(res.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockPrisma.role.create).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalled();
  });
});

describe("GET /api/v1/users/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/users/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "u1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockGetUserById.mockResolvedValue(null);
    const { GET } = await import("@/app/api/v1/users/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "u1" } });
    expect(res.status).toBe(404);
  });

  it("returns user by id", async () => {
    mockGetUserById.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const { GET } = await import("@/app/api/v1/users/[id]/route");
    const res = await GET(makeRequest("GET"), { params: { id: "u1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("u1");
  });
});

describe("PATCH /api/v1/users/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { PATCH } = await import("@/app/api/v1/users/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { displayName: "B" }), { params: { id: "u1" } });
    expect(res.status).toBe(401);
  });

  it("allows self-edit without user:manage permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", displayName: "A" });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", displayName: "B", email: "a@b.com", locale: "en", accentColor: null, theme: null, density: null });

    const { PATCH } = await import("@/app/api/v1/users/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { displayName: "B" }), { params: { id: "user-1" } });
    expect(res.status).toBe(200);
    expect(mockCan).not.toHaveBeenCalled();
  });

  it("returns 403 when editing other user without user:manage", async () => {
    mockCan.mockResolvedValue(false);
    const { PATCH } = await import("@/app/api/v1/users/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { displayName: "B" }), { params: { id: "u2" } });
    expect(res.status).toBe(403);
  });

  it("updates user and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u2", displayName: "A" });
    mockPrisma.user.update.mockResolvedValue({ id: "u2", displayName: "B", email: "a@b.com", locale: "en", accentColor: null, theme: null, density: null });

    const { PATCH } = await import("@/app/api/v1/users/[id]/route");
    const res = await PATCH(makeRequest("PATCH", { displayName: "B" }), { params: { id: "u2" } });

    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/users/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { DELETE } = await import("@/app/api/v1/users/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "u1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { DELETE } = await import("@/app/api/v1/users/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "u1" } });
    expect(res.status).toBe(403);
  });

  it("soft-deletes user and logs audit", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", status: "active" });
    mockSuspendUser.mockResolvedValue({ id: "u1", status: "suspended" });

    const { DELETE } = await import("@/app/api/v1/users/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params: { id: "u1" } });

    expect(res.status).toBe(200);
    expect(mockSuspendUser).toHaveBeenCalledWith("u1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user_suspended" }),
    );
  });
});
