import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/admin/users/u1/role", init);
}

const { auth } = await import("@/lib/auth/config");
const { can } = await import("@/lib/rbac");
const { logAudit } = await import("@/lib/audit/log");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as {
  role: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "admin-1" } });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("PATCH /api/v1/admin/users/[id]/role", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", { role: "admin" }), { params: { id: "u1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", { role: "admin" }), { params: { id: "u1" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 when role is missing", async () => {
    mockCan.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", {}), { params: { id: "u1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when role is invalid", async () => {
    mockCan.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", { role: "superadmin" }), { params: { id: "u1" } });
    expect(res.status).toBe(400);
  });

  it("creates new role when none exists", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.role.findFirst.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({ id: "r1", type: "admin" });

    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", { role: "admin" }), { params: { id: "u1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "admin" }) }),
    );
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("updates existing role", async () => {
    mockCan.mockResolvedValue(true);
    mockPrisma.role.findFirst.mockResolvedValue({ id: "r1", type: "member" });
    mockPrisma.role.update.mockResolvedValue({ id: "r1", type: "admin" });

    const { PATCH } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await PATCH(makeRequest("PATCH", { role: "admin" }), { params: { id: "u1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.role.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { type: "admin" },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ before: { role: "member" }, after: { role: "admin" } }),
    );
  });
});
