import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    taskAssignee: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    ldapGroupMembership: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    instanceSetting: {
      findUnique: vi.fn(),
    },
    taskDependency: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    notification: {
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createTask, updateTask, deleteTask } from "@/lib/tasks/mutations";

const mockTask = {
  id: "task-1",
  projectId: "proj-1",
  title: "Test Task",
  status: "open",
  priority: "med",
  orderIndex: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTask", () => {
  it("creates task with correct defaults", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: 0 } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);

    const result = await createTask({
      title: "Test Task",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
    });

    expect(result.id).toBe("task-1");
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "open",
          priority: "med",
        }),
      }),
    );
  });

  it("computes orderIndex as max + 1000", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: 3000 } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);

    await createTask({
      title: "Test",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderIndex: 4000 }),
      }),
    );
  });

  it("sets orderIndex to 1000 when no existing tasks", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: null } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);

    await createTask({
      title: "First Task",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderIndex: 1000 }),
      }),
    );
  });

  it("fans out a group assignment to the group's current members", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: null } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);
    vi.mocked(prisma.ldapGroupMembership.findMany).mockResolvedValue([
      { userId: "user-a" },
      { userId: "user-b" },
    ] as never);

    await createTask({
      title: "Group Task",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
      assigneeGroupId: "group-1",
    });

    expect(prisma.ldapGroupMembership.findMany).toHaveBeenCalledWith({
      where: { ldapSyncGroupId: "group-1" },
      select: { userId: true },
    });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeGroupId: "group-1",
          assignees: {
            create: [{ userId: "user-a" }, { userId: "user-b" }],
          },
        }),
      }),
    );
  });

  it("merges explicit assignees with the group fan-out and dedupes", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: null } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);
    vi.mocked(prisma.ldapGroupMembership.findMany).mockResolvedValue([
      { userId: "user-a" },
      { userId: "user-b" },
    ] as never);

    await createTask({
      title: "Group Task",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
      assigneeIds: ["user-c", "user-a"],
      assigneeGroupId: "group-1",
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignees: {
            create: expect.arrayContaining([
              { userId: "user-a" },
              { userId: "user-b" },
              { userId: "user-c" },
            ]),
          },
        }),
      }),
    );
  });

  it("is a no-op fan-out for an empty group", async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({ _max: { orderIndex: null } });
    vi.mocked(prisma.task.create).mockResolvedValue(mockTask as never);
    vi.mocked(prisma.ldapGroupMembership.findMany).mockResolvedValue([]);

    await createTask({
      title: "Empty Group Task",
      projectId: "proj-1",
      reporterId: "user-1",
      createdById: "user-1",
      assigneeGroupId: "group-empty",
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeGroupId: "group-empty",
          assignees: { create: [] },
        }),
      }),
    );
  });
});

describe("updateTask", () => {
  it("returns before and task snapshots", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", title: "Old" } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ id: "task-1", title: "New" } as never);

    const { before, task } = await updateTask("task-1", { title: "New" });

    expect(before?.id).toBe("task-1");
    expect(task.id).toBe("task-1");
  });

  it("sets completedAt when status changes to done", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", status: "open" } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ id: "task-1" } as never);

    await updateTask("task-1", { status: "done" });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "done",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("replaces assignee rows with the group fan-out when a group is assigned", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", title: "Old", status: "open" } as never);
    vi.mocked(prisma.taskAssignee.findMany).mockResolvedValue([{ userId: "user-old" }] as never);
    vi.mocked(prisma.ldapGroupMembership.findMany).mockResolvedValue([
      { userId: "user-a" },
      { userId: "user-b" },
    ] as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ id: "task-1", assigneeGroupId: "group-1" } as never);

    await updateTask("task-1", { assigneeGroupId: "group-1" });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeGroupId: "group-1",
          assignees: {
            deleteMany: { userId: { in: ["user-old"] } },
            create: [{ userId: "user-a" }, { userId: "user-b" }],
          },
        }),
      }),
    );
  });

  it("clears the fan-out rows when the group is removed", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", title: "Old", status: "open" } as never);
    vi.mocked(prisma.taskAssignee.findMany).mockResolvedValue([
      { userId: "user-a" },
      { userId: "user-b" },
    ] as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ id: "task-1", assigneeGroupId: null } as never);

    await updateTask("task-1", { assigneeGroupId: null });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeGroupId: null,
          assignees: {
            deleteMany: { userId: { in: ["user-a", "user-b"] } },
            create: [],
          },
        }),
      }),
    );
  });
});

describe("deleteTask", () => {
  it("sets deletedAt (soft delete)", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1" } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({} as never);

    const { before } = await deleteTask("task-1");

    expect(before?.id).toBe("task-1");
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });
});
