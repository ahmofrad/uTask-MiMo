import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ──
vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
    },
    projectBaseline: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    baselineEntry: {
      createMany: vi.fn(),
    },
    evmSnapshot: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        projectBaseline: {
          updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
          create: vi.fn(() => Promise.resolve({ id: "bl-1", projectId: "proj-1", name: "Test", source: "MANUAL", isCurrent: true, capturedBy: "user-1", capturedAt: new Date() })),
        },
        baselineEntry: {
          createMany: vi.fn(() => Promise.resolve({ count: 0 })),
        },
      };
      return fn(tx);
    }),
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn(() => Promise.resolve(undefined)),
}));

import {
  captureBaseline,
  computeEvm,
  snapshotEvm,
  getEvmSeries,
  getVarianceReport,
  compareBaselines,
} from "@/lib/baselines";
import { prisma } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("captureBaseline", () => {
  it("captures a baseline with task entries", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: "t1", startDate: new Date("2026-01-01"), dueDate: new Date("2026-01-15"), progress: 50, estimatedHours: 10, spentHours: 5, status: "in_progress" },
      { id: "t2", startDate: new Date("2026-01-10"), dueDate: new Date("2026-01-20"), progress: 0, estimatedHours: 5, spentHours: 0, status: "open" },
    ] as never);

    const result = await captureBaseline("proj-1", "Initial", "user-1");

    expect(result.name).toBeDefined();
    expect(result.isCurrent).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.budgetLineMinor).toBe(1000); // 10h × 100
    expect(result.entries[1]!.budgetLineMinor).toBe(500); // 5h × 100
  });
});

describe("computeEvm", () => {
  it("returns zeros when no baseline exists", async () => {
    vi.mocked(prisma.projectBaseline.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const result = await computeEvm("proj-1");

    expect(result.bac).toBe(0);
    expect(result.cpi).toBe(0);
    expect(result.spi).toBe(0);
  });

  it("computes EVM metrics correctly with a baseline", async () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);

    vi.mocked(prisma.projectBaseline.findFirst).mockResolvedValue({
      id: "bl-1",
      entries: [
        { taskId: "t1", startDate: start, endDate: new Date(now.getTime() + 30 * 86400000), percentComplete: 50, budgetLineMinor: 1000 },
        { taskId: "t2", startDate: start, endDate: new Date(now.getTime() + 30 * 86400000), percentComplete: 0, budgetLineMinor: 500 },
      ],
    } as never);

    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 10, spentHours: 6 },
      { id: "t2", progress: 0, estimatedHours: 5, spentHours: 2 },
    ] as never);

    const result = await computeEvm("proj-1", now);

    expect(result.bac).toBe(1500); // 1000 + 500
    expect(result.ev).toBe(500); // 50% of 1000 + 0% of 500
    expect(result.ac).toBe(800); // 6h + 2h = 8h × 100
    expect(result.pv).toBeGreaterThan(0);
    expect(result.cv).toBe(result.ev - result.ac); // 500 - 800 = -300
    expect(result.sv).toBe(result.ev - result.pv);
    expect(result.cpi).toBeGreaterThan(0);
    expect(result.spi).toBeGreaterThan(0);
  });

  it("handles zero AC gracefully (no division by zero)", async () => {
    vi.mocked(prisma.projectBaseline.findFirst).mockResolvedValue({
      id: "bl-1",
      entries: [{ taskId: "t1", startDate: new Date(), endDate: new Date(), percentComplete: 0, budgetLineMinor: 1000 }],
    } as never);

    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: "t1", progress: 0, estimatedHours: 10, spentHours: 0 },
    ] as never);

    const result = await computeEvm("proj-1");

    expect(result.ac).toBe(0);
    expect(result.cpi).toBe(0);
  });
});

describe("snapshotEvm", () => {
  it("creates a snapshot and returns metrics", async () => {
    vi.mocked(prisma.projectBaseline.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);
    vi.mocked(prisma.evmSnapshot.create).mockResolvedValue({
      id: "snap-1",
      projectId: "proj-1",
      snapshotDate: new Date(),
      bac: 0, pv: 0, ev: 0, ac: 0, cv: 0, sv: 0,
      cpi: 0, spi: 0, eac: 0, vac: 0, tcpi: 0,
      eacMethod: "CPI_BASED", currency: "USD", createdAt: new Date(),
    } as never);

    const result = await snapshotEvm("proj-1");

    expect(result.bac).toBe(0);
    expect(prisma.evmSnapshot.create).toHaveBeenCalled();
  });
});

describe("getEvmSeries", () => {
  it("returns an empty series when no snapshots exist", async () => {
    vi.mocked(prisma.evmSnapshot.findMany).mockResolvedValue([]);

    const result = await getEvmSeries("proj-1");

    expect(result).toEqual([]);
  });

  it("returns ordered series points", async () => {
    vi.mocked(prisma.evmSnapshot.findMany).mockResolvedValue([
      { snapshotDate: new Date("2026-01-01"), pv: 100, ev: 80, ac: 90, bac: 1000 },
      { snapshotDate: new Date("2026-01-15"), pv: 500, ev: 400, ac: 450, bac: 1000 },
    ] as never);

    const result = await getEvmSeries("proj-1");

    expect(result).toHaveLength(2);
    expect(result[0]!.pv).toBe(100);
    expect(result[1]!.ev).toBe(400);
  });
});

describe("getVarianceReport", () => {
  it("returns per-task variance data", async () => {
    vi.mocked(prisma.projectBaseline.findFirst).mockResolvedValue({
      id: "bl-1",
      entries: [{ taskId: "t1", budgetLineMinor: 1000 }, { taskId: "t2", budgetLineMinor: 500 }],
    } as never);

    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: "t1", title: "Task A", progress: 60, estimatedHours: 10, spentHours: 8, startDate: null, dueDate: null },
      { id: "t2", title: "Task B", progress: 10, estimatedHours: 5, spentHours: 4, startDate: null, dueDate: null },
    ] as never);

    const result = await getVarianceReport("proj-1");

    expect(result.baselineId).toBe("bl-1");
    expect(result.variances).toHaveLength(2);

    const taskA = result.variances.find((v) => v?.taskId === "t1");
    expect(taskA?.planned).toBe(1000);
    expect(taskA?.actual).toBe(800); // 8h × 100
    expect(taskA?.earned).toBe(600); // 60% of 1000
    expect(taskA?.costVariance).toBe(-200); // 600 - 800
    expect(taskA?.scheduleVariance).toBe(-400); // 600 - 1000
  });
});

describe("compareBaselines", () => {
  it("returns null for both when no baselines exist", async () => {
    vi.mocked(prisma.projectBaseline.findMany).mockResolvedValue([]);

    const result = await compareBaselines("proj-1");

    expect(result.current).toBeNull();
    expect(result.previous).toBeNull();
  });

  it("returns current and previous baselines", async () => {
    vi.mocked(prisma.projectBaseline.findMany).mockResolvedValue([
      { id: "bl-2", name: "Updated", isCurrent: true, capturedAt: new Date("2026-02-01"), entries: [{}, {}] },
      { id: "bl-1", name: "Initial", isCurrent: false, capturedAt: new Date("2026-01-01"), entries: [{}] },
    ] as never);

    const result = await compareBaselines("proj-1");

    expect(result.current?.id).toBe("bl-2");
    expect(result.current?.entryCount).toBe(2);
    expect(result.previous?.id).toBe("bl-1");
    expect(result.previous?.entryCount).toBe(1);
  });
});
