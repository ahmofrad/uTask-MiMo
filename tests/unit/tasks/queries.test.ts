import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/custom-fields/values", () => ({
  getCustomFieldValuesForTask: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/pagination", () => ({
  parsePaginationParams: vi.fn((params: { limit?: number; cursor?: string }) => ({
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

vi.mock("@/lib/tasks/filters", () => ({
  buildTaskFilters: vi.fn(() => ({ deletedAt: null, parentTaskId: null })),
}));

import { prisma } from "@/lib/db";
import { getTaskById, listTasks, getInboxTasks } from "@/lib/tasks/queries";

const mockTask = {
  id: "task-1",
  title: "Test Task",
  status: "open",
  priority: "med",
  projectId: "proj-1",
  assigneeId: null,
  reporterId: "user-1",
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTaskById", () => {
  it("returns task with custom fields when found", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask as never);

    const result = await getTaskById("task-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("task-1");
    expect(prisma.task.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
      }),
    );
  });

  it("returns null when task not found", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

    const result = await getTaskById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("listTasks", () => {
  it("returns paginated tasks", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([mockTask] as never);

    const result = await listTasks({ limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toBeDefined();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
        orderBy: { orderIndex: "asc" },
      }),
    );
  });

  it("applies filters via buildTaskFilters", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);

    await listTasks({ projectId: "proj-1", status: "open" });

    expect(prisma.task.findMany).toHaveBeenCalled();
  });
});

describe("getInboxTasks", () => {
  it("returns unassigned and watching tasks", async () => {
    const unassignedTask = { ...mockTask, assigneeId: null };
    const watchingTask = { ...mockTask, id: "task-2", assigneeId: "other-user" };

    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([unassignedTask] as never)
      .mockResolvedValueOnce([watchingTask] as never);

    const result = await getInboxTasks("user-1");

    expect(result.unassigned).toHaveLength(1);
    expect(result.watching).toHaveLength(1);
    expect(result.unassigned[0].assigneeId).toBeNull();
  });

  it("calls findMany twice for unassigned and watching", async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await getInboxTasks("user-1");

    expect(prisma.task.findMany).toHaveBeenCalledTimes(2);
  });

  it("filters out done tasks", async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await getInboxTasks("user-1");

    // First call is unassigned, second is watching
    const firstCall = vi.mocked(prisma.task.findMany).mock.calls[0][0];
    const secondCall = vi.mocked(prisma.task.findMany).mock.calls[1][0];

    expect(firstCall.where).toEqual(
      expect.objectContaining({
        status: { not: "done" },
      }),
    );
    expect(secondCall.where).toEqual(
      expect.objectContaining({
        status: { not: "done" },
      }),
    );
  });
});
