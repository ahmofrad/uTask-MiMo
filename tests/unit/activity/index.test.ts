import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuditFindMany, mockCommentFindMany, mockCanReadTask } = vi.hoisted(() => ({
  mockAuditFindMany: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCanReadTask: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { findMany: mockAuditFindMany },
    comment: { findMany: mockCommentFindMany },
  },
}));

vi.mock("@/lib/rbac", () => ({
  canReadTask: (...args: unknown[]) => mockCanReadTask(...args),
}));

import { getTaskActivity } from "@/lib/activity";

const auditRow = {
  id: "a1",
  action: "task_updated",
  actorUserId: "u1",
  occurredAt: new Date("2026-08-20T10:00:00Z"),
  beforeJson: { title: "old" },
  afterJson: { title: "new" },
  actor: { id: "u1", displayName: "Alice", email: "alice@x.com" },
};

const commentRow = {
  id: "c1",
  bodyMarkdown: "hello",
  authorId: "u1",
  createdAt: new Date("2026-08-21T10:00:00Z"),
  parentCommentId: null,
  deletedAt: null,
  taskId: "t1",
  author: { id: "u1", displayName: "Alice", email: "alice@x.com" },
};

describe("getTaskActivity", () => {
  beforeEach(() => {
    mockCanReadTask.mockReset().mockResolvedValue(true);
    mockAuditFindMany.mockReset().mockResolvedValue([]);
    mockCommentFindMany.mockReset().mockResolvedValue([]);
  });

  it("returns empty activity for users without read access", async () => {
    mockCanReadTask.mockResolvedValue(false);
    const result = await getTaskActivity("t1", "u2");
    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(mockAuditFindMany).not.toHaveBeenCalled();
  });

  it("merges audit logs and comments, newest first", async () => {
    mockAuditFindMany.mockResolvedValue([auditRow]);
    mockCommentFindMany.mockResolvedValue([commentRow]);
    const result = await getTaskActivity("t1", "u1");
    expect(result.items).toHaveLength(2);
    // Comment (Aug 21) sorts before audit (Aug 20)
    expect(result.items[0]).toMatchObject({ type: "comment", id: "c1" });
    expect(result.items[1]).toMatchObject({ type: "audit", id: "a1" });
  });

  it("maps audit rows to ActivityEvent shape", async () => {
    mockAuditFindMany.mockResolvedValue([auditRow]);
    const result = await getTaskActivity("t1", "u1");
    expect(result.items[0]).toEqual({
      type: "audit",
      id: "a1",
      action: "task_updated",
      actorId: "u1",
      actorName: "Alice",
      createdAt: "2026-08-20T10:00:00.000Z",
      details: { before: { title: "old" }, after: { title: "new" } },
    });
  });

  it("maps comment rows to ActivityEvent shape with parent id", async () => {
    mockCommentFindMany.mockResolvedValue([{ ...commentRow, parentCommentId: "root" }]);
    const result = await getTaskActivity("t1", "u1");
    expect(result.items[0]).toMatchObject({
      type: "comment",
      id: "c1",
      body: "hello",
      authorId: "u1",
      authorName: "Alice",
      parentCommentId: "root",
    });
  });

  it("drops details when neither before nor after is present", async () => {
    mockAuditFindMany.mockResolvedValue([{ ...auditRow, beforeJson: null, afterJson: null }]);
    const result = await getTaskActivity("t1", "u1");
    expect(result.items[0].details).toBeUndefined();
  });

  it("respects the limit and reports hasMore", async () => {
    const manyAudits = Array.from({ length: 5 }, (_, i) => ({
      ...auditRow,
      id: `a${i}`,
      occurredAt: new Date(Date.UTC(2026, 7, 20, 0, i)),
    }));
    mockAuditFindMany.mockResolvedValue(manyAudits);
    const result = await getTaskActivity("t1", "u1", { limit: 3 });
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toMatch(/^audit:/);
  });

  it("uses cursor pagination when a cursor is provided", async () => {
    mockAuditFindMany.mockResolvedValue([auditRow]);
    mockCommentFindMany.mockResolvedValue([]);
    await getTaskActivity("t1", "u1", { cursor: "audit:a1", limit: 10 });
    expect(mockAuditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "a1" } }),
    );
  });
});