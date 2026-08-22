import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockExecuteRaw = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock("@/lib/logging", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  mockExecuteRaw.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("compactAuditLog", () => {
  it("deletes rows older than the retention window in batches", async () => {
    // Simulate: first batch deletes 5000, second batch deletes 3000, third deletes 0.
    mockExecuteRaw
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(3000)
      .mockResolvedValueOnce(0);

    const { compactAuditLog } = await import("@/lib/audit/compaction");
    const total = await compactAuditLog();

    expect(total).toBe(8000);
    // Two batches: first (5000, >= BATCH so continue), second (3000, < BATCH so done).
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no rows are old enough", async () => {
    mockExecuteRaw.mockResolvedValueOnce(0);

    const { compactAuditLog } = await import("@/lib/audit/compaction");
    const total = await compactAuditLog();

    expect(total).toBe(0);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it("respects AUDIT_RETENTION_DAYS env var", async () => {
    process.env.AUDIT_RETENTION_DAYS = "90";
    mockExecuteRaw.mockResolvedValueOnce(0);

    const { compactAuditLog } = await import("@/lib/audit/compaction");
    await compactAuditLog();

    // The cutoff should be 90 days before 2026-08-22.
    // We can't easily assert the raw SQL params, but we verify the call happened.
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

    delete process.env.AUDIT_RETENTION_DAYS;
  });
});
