import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    projectBaseline: { findFirst: vi.fn() },
    task: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

const mockedBaseline = vi.mocked(prisma.projectBaseline.findFirst);
const mockedTasks = vi.mocked(prisma.task.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeEvm", () => {
  it("returns zeroed metrics when no baseline exists", async () => {
    mockedBaseline.mockResolvedValue(null);
    const { computeEvm } = await import("@/lib/baselines");

    const result = await computeEvm("proj-1");

    expect(result.bac).toBe(0);
    expect(result.pv).toBe(0);
    expect(result.ev).toBe(0);
    expect(result.ac).toBe(0);
    expect(result.cpi).toBe(0);
    expect(result.spi).toBe(0);
  });

  it("computes correct BAC from baseline entries", async () => {
    mockedBaseline.mockResolvedValue({
      id: "baseline-1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") },
        { taskId: "t2", budgetLineMinor: 5000, startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([]);

    const { computeEvm } = await import("@/lib/baselines");
    const result = await computeEvm("proj-1");

    expect(result.bac).toBe(15000);
  });

  it("computes EV weighted by task progress", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
        { taskId: "t2", budgetLineMinor: 5000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 80, estimatedHours: 100, spentHours: 80 },
      { id: "t2", progress: 40, estimatedHours: 50, spentHours: 30 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    // EV = 80% × 10000 + 40% × 5000 = 8000 + 2000 = 10000
    const result = await computeEvm("proj-1", new Date("2026-12-31"));
    expect(result.ev).toBe(10000);
  });

  it("computes AC from spent hours × 100", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 100, spentHours: 60 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    // AC = 60 × 100 = 6000
    const result = await computeEvm("proj-1");
    expect(result.ac).toBe(6000);
  });

  it("CPI-based EAC formula is correct", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 100, spentHours: 60 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    // EV=5000, AC=6000, CPI=5000/6000=0.833, EAC=6000+(10000-5000)/0.833=6000+6000=12000
    const result = await computeEvm("proj-1", new Date("2026-12-31"), "CPI_BASED");
    expect(result.cpi).toBeCloseTo(0.833, 2);
    expect(result.eac).toBe(12000);
  });

  it("SPI-based EAC uses schedule performance", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 100, spentHours: 60 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    // At 2026-12-31, PV = BAC = 10000, EV = 5000, SPI = 5000/10000 = 0.5
    // EAC = AC + (BAC - EV) / SPI = 6000 + 5000 / 0.5 = 6000 + 10000 = 16000
    const result = await computeEvm("proj-1", new Date("2026-12-31"), "SPI_BASED");
    expect(result.eac).toBe(16000);
  });

  it("TCPI-based EAC is correct", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 100, spentHours: 60 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    // TCPI = (BAC - EV) / (BAC - AC) = 5000 / 4000 = 1.25
    // EAC = AC + (BAC - EV) / TCPI = 6000 + 5000 / 1.25 = 6000 + 4000 = 10000
    const result = await computeEvm("proj-1", new Date("2026-12-31"), "TCPI_BASED");
    expect(result.eac).toBe(10000);
  });

  it("cost variance (CV) is EV - AC", async () => {
    mockedBaseline.mockResolvedValue({
      id: "b1",
      entries: [
        { taskId: "t1", budgetLineMinor: 10000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ],
    } as never);
    mockedTasks.mockResolvedValue([
      { id: "t1", progress: 50, estimatedHours: 100, spentHours: 60 },
    ] as never);

    const { computeEvm } = await import("@/lib/baselines");
    const result = await computeEvm("proj-1");
    // CV = EV - AC = 5000 - 6000 = -1000
    expect(result.cv).toBe(-1000);
  });
});
