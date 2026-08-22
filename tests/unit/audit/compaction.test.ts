import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecuteRaw } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $executeRaw: mockExecuteRaw },
}));
vi.mock("@/lib/logging", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { compactAuditLog } from "@/lib/audit/compaction";

describe("compactAuditLog", () => {
  beforeEach(() => {
    mockExecuteRaw.mockReset().mockResolvedValue(0);
  });

  it("returns 0 when no rows are old enough", async () => {
    const deleted = await compactAuditLog();
    expect(deleted).toBe(0);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it("deletes in batches until fewer than batch size", async () => {
    mockExecuteRaw
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(1200)
      .mockResolvedValueOnce(0);
    const deleted = await compactAuditLog();
    expect(deleted).toBe(11200);
    // Loop breaks when a batch returns fewer than BATCH_SIZE (1200 < 5000)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3);
  });

  it("honors the AUDIT_RETENTION_DAYS env var", async () => {
    process.env.AUDIT_RETENTION_DAYS = "30";
    mockExecuteRaw.mockResolvedValue(10);
    await compactAuditLog();
    const sql = mockExecuteRaw.mock.calls[0]![0] as unknown as string[];
    expect(sql.join("")).toContain("occurredAt");
    delete process.env.AUDIT_RETENTION_DAYS;
  });
});