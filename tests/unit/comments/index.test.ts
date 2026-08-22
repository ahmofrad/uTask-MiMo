import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCommentCreate,
  mockCommentFindMany,
  mockCommentFindUnique,
  mockCommentFindFirst,
  mockCommentUpdate,
} = vi.hoisted(() => ({
  mockCommentCreate: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCommentFindUnique: vi.fn(),
  mockCommentFindFirst: vi.fn(),
  mockCommentUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    comment: {
      findMany: mockCommentFindMany,
      findUnique: mockCommentFindUnique,
      findFirst: mockCommentFindFirst,
      create: mockCommentCreate,
      update: mockCommentUpdate,
    },
  },
}));

vi.mock("@/lib/markdown/render", () => ({
  renderMarkdown: vi.fn((md: string) => `<p>${md}</p>`),
}));

import {
  getTaskComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
} from "@/lib/comments";

const baseComment = {
  id: "c1",
  taskId: "t1",
  authorId: "u1",
  bodyMarkdown: "<p>hello</p>",
  parentCommentId: null,
  deletedAt: null,
  editedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: "u1", displayName: "Alice", email: "alice@test.com", avatarUrl: null },
};

describe("getTaskComments", () => {
  it("fetches comments with replies for a task", async () => {
    mockCommentFindMany.mockResolvedValue([{ ...baseComment, replies: [] }]);
    const result = await getTaskComments("t1");
    expect(result).toHaveLength(1);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: "t1", deletedAt: null } }),
    );
  });

  it("excludes soft-deleted comments", async () => {
    mockCommentFindMany.mockResolvedValue([]);
    await getTaskComments("t1");
    const callArgs = mockCommentFindMany.mock.calls[0]![0]!;
    expect(callArgs.where.deletedAt).toBe(null);
  });
});

describe("getCommentById", () => {
  it("returns a comment by id", async () => {
    mockCommentFindUnique.mockResolvedValue(baseComment);
    const result = await getCommentById("c1");
    expect(result).toEqual(baseComment);
  });

  it("returns null for nonexistent id", async () => {
    mockCommentFindUnique.mockResolvedValue(null);
    const result = await getCommentById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("createComment", () => {
  beforeEach(() => {
    mockCommentCreate.mockReset();
  });

  it("creates a comment with sanitized markdown", async () => {
    mockCommentCreate.mockResolvedValue({ ...baseComment, bodyMarkdown: "<p>test</p>" });
    const result = await createComment({
      taskId: "t1",
      authorId: "u1",
      bodyMarkdown: "test",
    });
    expect(result.bodyMarkdown).toBe("<p>test</p>");
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "t1",
          authorId: "u1",
          parentCommentId: null,
        }),
      }),
    );
  });

  it("sets parentCommentId when provided", async () => {
    mockCommentCreate.mockResolvedValue({ ...baseComment, parentCommentId: "parent1" });
    await createComment({
      taskId: "t1",
      authorId: "u1",
      bodyMarkdown: "reply",
      parentCommentId: "parent1",
    });
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentCommentId: "parent1" }),
      }),
    );
  });
});

describe("updateComment", () => {
  it("updates own comment", async () => {
    mockCommentFindFirst.mockResolvedValue(baseComment);
    mockCommentUpdate.mockResolvedValue({ ...baseComment, bodyMarkdown: "<p>updated</p>", editedAt: new Date() });
    const result = await updateComment("c1", "u1", { bodyMarkdown: "updated" });
    expect(result).not.toBeNull();
    if (result && !("forbidden" in result)) {
      expect(result.bodyMarkdown).toBe("<p>updated</p>");
    }
  });

  it("returns null for nonexistent comment", async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    const result = await updateComment("nonexistent", "u1", { bodyMarkdown: "x" });
    expect(result).toBeNull();
  });

  it("returns forbidden for non-author", async () => {
    mockCommentFindFirst.mockResolvedValue({ ...baseComment, authorId: "u2" });
    const result = await updateComment("c1", "u1", { bodyMarkdown: "x" });
    expect(result).toEqual({ forbidden: true });
  });
});

describe("deleteComment", () => {
  it("soft-deletes own comment", async () => {
    mockCommentFindFirst.mockResolvedValue(baseComment);
    mockCommentUpdate.mockResolvedValue({});
    const result = await deleteComment("c1", "u1");
    expect(result).toEqual({ success: true });
    expect(mockCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("returns null for nonexistent comment", async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    const result = await deleteComment("nonexistent", "u1");
    expect(result).toBeNull();
  });

  it("returns forbidden for non-author", async () => {
    mockCommentFindFirst.mockResolvedValue({ ...baseComment, authorId: "u2" });
    const result = await deleteComment("c1", "u1");
    expect(result).toEqual({ forbidden: true });
  });
});