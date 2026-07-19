import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: vi.fn() }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    projectMember: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

const { auth } = await import("@/lib/auth/config");
const { prisma } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as {
  user: { findMany: ReturnType<typeof vi.fn> };
  projectMember: { findMany: ReturnType<typeof vi.fn> };
};

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockCan.mockResolvedValue(true);
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("GET /api/v1/users/search", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/users/search/route");
    const res = await GET(makeRequest("http://localhost/api/v1/users/search?q=alice"));
    expect(res.status).toBe(401);
  });

  it("returns empty data when query is empty", async () => {
    const { GET } = await import("@/app/api/v1/users/search/route");
    const res = await GET(makeRequest("http://localhost/api/v1/users/search?q="));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("searches by name/email", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", displayName: "Alice", email: "alice@example.com", avatarUrl: null },
    ]);

    const { GET } = await import("@/app/api/v1/users/search/route");
    const res = await GET(makeRequest("http://localhost/api/v1/users/search?q=alice"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].displayName).toBe("Alice");
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("excludes existing members when projectId is given", async () => {
    mockPrisma.projectMember.findMany.mockResolvedValue([{ userId: "u2" }]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", displayName: "Alice", email: "alice@example.com", avatarUrl: null },
    ]);

    const { GET } = await import("@/app/api/v1/users/search/route");
    const res = await GET(makeRequest("http://localhost/api/v1/users/search?q=alice&projectId=p1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      select: { userId: true },
    });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ["u2"] } }),
      }),
    );
  });

  it("does not query project members when no projectId", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/v1/users/search/route");
    await GET(makeRequest("http://localhost/api/v1/users/search?q=alice"));

    expect(mockPrisma.projectMember.findMany).not.toHaveBeenCalled();
  });
});
