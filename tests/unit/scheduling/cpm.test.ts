import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    task: { findMany: vi.fn() },
    taskDependency: { findMany: vi.fn() },
  },
}));

import { computeSchedule, invalidateScheduleCache } from "@/lib/scheduling/cpm";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma);
const DAY_MS = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  invalidateScheduleCache("proj-1");
});

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    parentTaskId: null,
    startDate: new Date("2025-07-01"),
    dueDate: new Date("2025-07-05"),
    estimatedHours: 8,
    isMilestone: false,
    progress: 0,
    status: "open",
    ...overrides,
  };
}

describe("computeSchedule", () => {
  it("returns empty schedule for project with no tasks", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    const result = await computeSchedule("proj-1");

    expect(result.schedule).toEqual({});
    expect(result.criticalChain).toEqual([]);
    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });

  it("schedules a single task with start and due dates", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([makeTask()] as never);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    const result = await computeSchedule("proj-1");

    expect(result.schedule["task-1"]).toBeDefined();
    expect(result.schedule["task-1"]!.unscheduled).toBe(false);
  });

  it("marks milestones as scheduled with zero duration", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ id: "milestone-1", isMilestone: true, dueDate: new Date("2025-07-05"), startDate: null }),
    ] as never);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    const result = await computeSchedule("proj-1");

    expect(result.schedule["milestone-1"]).toBeDefined();
    expect(result.schedule["milestone-1"]!.unscheduled).toBe(false);
  });

  it("skips summary (parent) tasks", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ id: "parent-1" }),
      makeTask({ id: "child-1", parentTaskId: "parent-1" }),
    ] as never);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    const result = await computeSchedule("proj-1");

    expect(result.schedule["parent-1"]).toBeUndefined();
    expect(result.schedule["child-1"]).toBeDefined();
  });

  it("uses cache on repeated calls with same version", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([makeTask()] as never);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    await computeSchedule("proj-1");
    await computeSchedule("proj-1");

    // Second call should hit cache — Prisma called only once
    expect(mockPrisma.task.findMany).toHaveBeenCalledTimes(1);
  });

  it("invalidates cache when version changes", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 1 } as never);
    mockPrisma.task.findMany.mockResolvedValue([makeTask()] as never);
    mockPrisma.taskDependency.findMany.mockResolvedValue([]);

    await computeSchedule("proj-1");

    mockPrisma.project.findUnique.mockResolvedValue({ scheduleVersion: 2 } as never);
    await computeSchedule("proj-1");

    // Version changed → cache miss → Prisma called twice
    expect(mockPrisma.task.findMany).toHaveBeenCalledTimes(2);
  });
});
