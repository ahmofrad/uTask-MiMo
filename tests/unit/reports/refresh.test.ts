import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// $executeRawUnsafe is the only prisma surface the refresh module touches.
const mockExecuteRawUnsafe = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

// Silence the logger so test output stays clean.
vi.mock("@/lib/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function undefinedRelationError(): unknown {
  // Mirror Prisma's runtime shape: meta.code carries the Postgres SQLSTATE.
  const e = new Prisma.PrismaClientKnownRequestError(
    "relation \"mv_project_task_stats\" does not exist",
    { code: "P2010", clientVersion: "5.22.0", meta: { code: "42P01" } },
  );
  // The constructor may not copy `meta` to the instance in all runtime paths.
  // Force-set it so the test error matches what the refresh guard inspects.
  Object.assign(e, { meta: { code: "42P01" } });
  return e;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockExecuteRawUnsafe.mockReset();
  // Clear the module-level missing-view set so test ordering doesn't leak.
  const { _resetMissingViewsForTest } = await import("@/lib/reports/refresh");
  _resetMissingViewsForTest();
});

describe("refreshMaterializedViews", () => {
  it("refreshes every view when all succeed", async () => {
    mockExecuteRawUnsafe.mockResolvedValue(undefined);
    const { refreshMaterializedViews } = await import("@/lib/reports/refresh");

    await refreshMaterializedViews(true);

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(3);
    const sqls = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    // mv_project_task_stats and mv_user_task_stats refresh concurrently.
    expect(sqls[0]).toMatch(/CONCURRENTLY/);
    expect(sqls[1]).toMatch(/CONCURRENTLY/);
    // mv_org_stats has no plain-column unique index, so it must refresh
    // non-concurrently to avoid Postgres error 55000.
    expect(sqls[2]).not.toMatch(/CONCURRENTLY/);
    expect(sqls[2]).toMatch(/REFRESH MATERIALIZED VIEW "mv_org_stats"/);
  });

  it("skips a missing view and does not retry it on subsequent runs", async () => {
    mockExecuteRawUnsafe
      .mockRejectedValueOnce(undefinedRelationError()) // mv_project_task_stats missing
      .mockResolvedValueOnce(undefined) // mv_user_task_stats ok
      .mockResolvedValueOnce(undefined); // mv_org_stats ok

    const { refreshMaterializedViews } = await import("@/lib/reports/refresh");

    await refreshMaterializedViews(true);

    // First run: all three attempted (one failed, two succeeded).
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(3);

    // Second run: the missing view is skipped, only two attempted.
    mockExecuteRawUnsafe.mockClear();
    await refreshMaterializedViews(true);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
    const attempted = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(attempted.every((s) => !s.includes("mv_project_task_stats"))).toBe(true);
  });

  it("logs an error (not a warn) for non-missing-view failures", async () => {
    const { logger } = await import("@/lib/logging");
    const transient = new Prisma.PrismaClientKnownRequestError("connection refused", {
      code: "P1001",
      clientVersion: "5.22.0",
    });
    mockExecuteRawUnsafe
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const { refreshMaterializedViews } = await import("@/lib/reports/refresh");

    await refreshMaterializedViews(true);

    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
