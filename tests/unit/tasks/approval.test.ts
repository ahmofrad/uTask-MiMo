import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    taskAssignee: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    notification: {
      create: vi.fn(() => Promise.resolve({})),
    },
    taskDependency: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    instanceSetting: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

vi.mock("@/lib/rbac", () => ({
  canProject: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { canProject } from "@/lib/rbac";
import {
  isTaskFinalizer,
  shouldRouteToApproval,
  TaskNotPendingApprovalError,
} from "@/lib/tasks/approval";
import { updateTask, approveTask, rejectTask } from "@/lib/tasks/mutations";
import { evaluateStatusChange } from "@/lib/tasks/dependencies";

vi.mock("@/lib/tasks/dependencies", () => ({
  evaluateStatusChange: vi.fn(() => Promise.resolve({ allowed: true, blockers: [] })),
  notifyUnblocked: vi.fn(() => Promise.resolve()),
  DependencyBlockedError: class DependencyBlockedError extends Error {},
}));

const mockedEvaluate = vi.mocked(evaluateStatusChange);

beforeEach(() => {
  vi.clearAllMocks();
  mockedEvaluate.mockResolvedValue({ allowed: true, blockers: [] } as never);
});

describe("shouldRouteToApproval", () => {
  it("reroutes a DONE transition when approval is required and the actor is not a finalizer", () => {
    expect(
      shouldRouteToApproval({
        requiresApproval: true,
        requestedStatus: "done",
        actorIsFinalizer: false,
      }),
    ).toBe(true);
  });

  it("does not reroute when the actor is a finalizer", () => {
    expect(
      shouldRouteToApproval({
        requiresApproval: true,
        requestedStatus: "done",
        actorIsFinalizer: true,
      }),
    ).toBe(false);
  });

  it("does not reroute tasks that do not require approval", () => {
    expect(
      shouldRouteToApproval({
        requiresApproval: false,
        requestedStatus: "done",
        actorIsFinalizer: false,
      }),
    ).toBe(false);
  });

  it("does not reroute non-DONE transitions", () => {
    expect(
      shouldRouteToApproval({
        requiresApproval: true,
        requestedStatus: "in_progress",
        actorIsFinalizer: false,
      }),
    ).toBe(false);
  });
});

describe("isTaskFinalizer", () => {
  it("allows the designated approver regardless of project role", async () => {
    vi.mocked(canProject).mockResolvedValue(false);
    const result = await isTaskFinalizer("approver-1", {
      projectId: "proj-1",
      approverId: "approver-1",
    });
    expect(result).toBe(true);
    expect(canProject).not.toHaveBeenCalled();
  });

  it("falls back to task:edit_any for non-approvers", async () => {
    vi.mocked(canProject).mockResolvedValue(true);
    const result = await isTaskFinalizer("user-1", {
      projectId: "proj-1",
      approverId: "approver-1",
    });
    expect(result).toBe(true);
    expect(canProject).toHaveBeenCalledWith("user-1", "task:edit_any", "proj-1");
  });

  it("denies plain editors without edit_any", async () => {
    vi.mocked(canProject).mockResolvedValue(false);
    const result = await isTaskFinalizer("user-1", { projectId: "proj-1", approverId: null });
    expect(result).toBe(false);
  });
});

describe("updateTask approval reroute", () => {
  const baseTask = {
    id: "task-1",
    projectId: "proj-1",
    requiresApproval: true,
    approverId: "approver-1",
    status: "in_progress",
    completedAt: null,
    approvalNote: null,
    title: "Gate me",
    createdById: "user-1",
    deletedAt: null,
  };

  it("reroutes a non-finalizer's DONE transition to pending_approval", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ ...baseTask } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      ...baseTask,
      status: "pending_approval",
    } as never);
    vi.mocked(canProject).mockResolvedValue(false);

    const { task } = await updateTask("task-1", { status: "done" }, "member-1");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending_approval",
          completedAt: null,
          approvalNote: null,
        }),
      }),
    );
    expect(task.status).toBe("pending_approval");
  });

  it("lets a finalizer complete a require-approval task directly", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ ...baseTask } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      ...baseTask,
      status: "done",
      completedAt: new Date(),
    } as never);
    vi.mocked(canProject).mockResolvedValue(true);

    await updateTask("task-1", { status: "done" }, "lead-1");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "done",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("lets the designated approver complete the task directly", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ ...baseTask } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      ...baseTask,
      status: "done",
      completedAt: new Date(),
    } as never);

    await updateTask("task-1", { status: "done" }, "approver-1");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "done" }),
      }),
    );
    expect(canProject).not.toHaveBeenCalled();
  });

  it("does not reroute tasks without requiresApproval", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      ...baseTask,
      requiresApproval: false,
    } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      ...baseTask,
      status: "done",
      completedAt: new Date(),
    } as never);

    await updateTask("task-1", { status: "done" }, "member-1");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "done" }),
      }),
    );
  });
});

describe("approveTask", () => {
  it("moves a pending task to done and stamps completion", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      status: "pending_approval",
      deletedAt: null,
      title: "Gate me",
      createdById: "user-1",
      projectId: "proj-1",
      approverId: null,
      approvalNote: "not good enough",
    } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ id: "task-1", status: "done" } as never);

    await approveTask("task-1", "approver-1");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "done",
          completedAt: expect.any(Date),
          progress: 100,
          approvalNote: null,
        }),
      }),
    );
  });

  it("throws when the task is not awaiting approval", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      status: "open",
      deletedAt: null,
    } as never);

    await expect(approveTask("task-1", "approver-1")).rejects.toBeInstanceOf(
      TaskNotPendingApprovalError,
    );
  });
});

describe("rejectTask", () => {
  it("moves a pending task back to in_progress with the reason", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      status: "pending_approval",
      deletedAt: null,
      title: "Gate me",
      createdById: "user-1",
      projectId: "proj-1",
      approverId: null,
      approvalNote: null,
    } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({
      id: "task-1",
      status: "in_progress",
    } as never);

    await rejectTask("task-1", "approver-1", "Missing the spec details");

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "in_progress",
          completedAt: null,
          approvalNote: "Missing the spec details",
        }),
      }),
    );
  });

  it("throws when the task is not awaiting approval", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: "task-1",
      status: "done",
      deletedAt: null,
    } as never);

    await expect(rejectTask("task-1", "approver-1", "why")).rejects.toBeInstanceOf(
      TaskNotPendingApprovalError,
    );
  });
});
