import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ revokeUserSessions: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/pagination", () => ({
  parsePaginationParams: vi.fn((params: { limit?: number; cursor?: string; status?: string; role?: string }) => ({
    take: (params.limit ?? 50) + 1,
    skip: params.cursor ? 1 : 0,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    limit: params.limit ?? 50,
  })),
  buildPaginatedMeta: vi.fn((items: { id: string }[], limit: number) => ({
    nextCursor: items.length > limit ? items[items.length - 1]?.id ?? null : null,
    hasMore: items.length > limit,
  })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

import { prisma } from "@/lib/db";
import { getUserById, listUsers, suspendUser, restoreUser } from "@/lib/users";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  displayName: "Test User",
  avatarUrl: null,
  locale: "en-US",
  accentColor: null,
  theme: "light",
  density: "normal",
  status: "active",
  lastLoginAt: null,
  createdAt: new Date(),
  roles: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserById", () => {
  it("returns user by id", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await getUserById("user-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
      }),
    );
  });

  it("returns null when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await getUserById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("listUsers", () => {
  it("returns paginated users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as never);

    const result = await listUsers({ limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toBeDefined();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("filters by status when provided", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await listUsers({ status: "active" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("filters by role when provided", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await listUsers({ role: "admin" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { type: "admin", scopeType: "global" } },
        }),
      }),
    );
  });

  it("uses empty where when no filters", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await listUsers({});

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });
});

describe("suspendUser", () => {
  it("sets user status to suspended", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, status: "suspended" } as never);

    const result = await suspendUser("user-1");

    expect(result.status).toBe("suspended");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "suspended" },
    });
  });
});

describe("restoreUser", () => {
  it("sets user status to active", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, status: "active" } as never);

    const result = await restoreUser("user-1");

    expect(result.status).toBe("active");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "active" },
    });
  });
});
