import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { auditLog: { findMany: mockFindMany } },
}));
vi.mock("@/lib/db/pagination", () => ({
  parsePaginationParams: vi.fn(() => ({ take: 50, skip: 0, cursor: undefined, limit: 50 })),
  buildPaginatedMeta: vi.fn(() => ({ hasMore: false })),
}));

import { listAuditLogs, isGroupAccessAction } from "@/lib/audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("isGroupAccessAction", () => {
  it("returns true for grants, revokes and membership changes", () => {
    expect(isGroupAccessAction("group_grant_created")).toBe(true);
    expect(isGroupAccessAction("group_grant_revoked")).toBe(true);
    expect(isGroupAccessAction("group_member_added")).toBe(true);
    expect(isGroupAccessAction("group_member_removed")).toBe(true);
  });

  it("returns false for other group actions and unrelated actions", () => {
    expect(isGroupAccessAction("group_created")).toBe(false);
    expect(isGroupAccessAction("group_deleted")).toBe(false);
    expect(isGroupAccessAction("task_created")).toBe(false);
    expect(isGroupAccessAction("login_success")).toBe(false);
  });
});

describe("listAuditLogs", () => {
  it("applies a groupAccess where filter", async () => {
    await listAuditLogs({ groupAccess: true });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: {
            in: [
              "group_grant_created",
              "group_grant_revoked",
              "group_member_added",
              "group_member_removed",
            ],
          },
        },
      }),
    );
  });

  it("applies entityType and action filters", async () => {
    await listAuditLogs({ entityType: "project", action: "project_created" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: "project", action: "project_created" },
      }),
    );
  });

  it("leaves where empty when no filters are given", async () => {
    await listAuditLogs({});
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(arg.where).toEqual({});
  });

  it("includes the actor relation", async () => {
    await listAuditLogs({});
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
      }),
    );
  });
});
