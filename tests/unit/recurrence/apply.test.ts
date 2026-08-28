import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhook/emit", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

import { sweepRecurringTasks, decodeRecurrenceRule, encodeRecurrenceRule, nextOccurrenceDate, shouldSpawnNext } from "@/lib/tasks/recurrence";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sweepRecurringTasks", () => {
  it("returns 0 when no recurring tasks exist", async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    const count = await sweepRecurringTasks(mockPrisma.task);
    expect(count).toBe(0);
    expect(mockPrisma.task.create).not.toHaveBeenCalled();
  });

  it("skips done/cancelled tasks (findMany filters them out)", async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    const count = await sweepRecurringTasks(mockPrisma.task);
    expect(count).toBe(0);
  });
});

describe("decodeRecurrenceRule", () => {
  it("decodes valid rule", () => {
    const rule = decodeRecurrenceRule('{"freq":"WEEKLY","interval":1}');
    expect(rule).toEqual({ freq: "WEEKLY", interval: 1, anchor: "dueDate" });
  });

  it("returns null for null/undefined", () => {
    expect(decodeRecurrenceRule(null)).toBeNull();
    expect(decodeRecurrenceRule(undefined)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(decodeRecurrenceRule("not-json")).toBeNull();
  });

  it("returns null for invalid rule shape", () => {
    expect(decodeRecurrenceRule('{"freq":"INVALID"}')).toBeNull();
  });
});

describe("encodeRecurrenceRule", () => {
  it("round-trips through decode", () => {
    const original = { freq: "DAILY" as const, interval: 1 };
    const encoded = encodeRecurrenceRule(original);
    const decoded = decodeRecurrenceRule(encoded);
    // anchor defaults to "dueDate" via Zod schema
    expect(decoded).toEqual({ ...original, anchor: "dueDate" });
  });
});

describe("nextOccurrenceDate", () => {
  it("advances daily by interval", () => {
    const rule = { freq: "DAILY" as const, interval: 3 };
    const anchor = new Date(2025, 0, 1); // Jan 1
    const next = nextOccurrenceDate(rule, anchor);
    expect(next.getDate()).toBe(4); // Jan 4
  });

  it("advances weekly by interval", () => {
    const rule = { freq: "WEEKLY" as const, interval: 2 };
    const anchor = new Date(2025, 0, 1); // Wed
    const next = nextOccurrenceDate(rule, anchor);
    expect(next.getDate()).toBe(15); // 14 days later
  });
});

describe("shouldSpawnNext", () => {
  it("returns true when no caps", () => {
    const rule = { freq: "DAILY" as const, interval: 1 };
    expect(shouldSpawnNext(rule, new Date())).toBe(true);
  });

  it("returns false when count is 0", () => {
    const rule = { freq: "DAILY" as const, interval: 1, count: 0 };
    expect(shouldSpawnNext(rule, new Date())).toBe(false);
  });

  it("returns false when next date exceeds endDate", () => {
    const rule = { freq: "DAILY" as const, interval: 1, endDate: "2025-01-10" };
    const futureDate = new Date(2025, 0, 20);
    expect(shouldSpawnNext(rule, futureDate)).toBe(false);
  });

  it("returns true when next date is before endDate", () => {
    const rule = { freq: "DAILY" as const, interval: 1, endDate: "2025-01-20" };
    const earlyDate = new Date(2025, 0, 10);
    expect(shouldSpawnNext(rule, earlyDate)).toBe(true);
  });
});
