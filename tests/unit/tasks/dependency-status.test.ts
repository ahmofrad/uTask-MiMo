import { describe, it, expect } from "vitest";
import { hasInvalidLink, type PredecessorInfo } from "@/lib/tasks/dependency-status";

const pred = (overrides: Partial<PredecessorInfo> = {}): PredecessorInfo => ({
  id: "p1",
  title: "Build UI",
  status: "in_progress",
  startDate: "2026-08-01T00:00:00.000Z",
  dueDate: "2026-08-10T00:00:00.000Z",
  ...overrides,
});

describe("hasInvalidLink", () => {
  it("flags a task that starts before its predecessor finishes", () => {
    expect(hasInvalidLink("2026-08-09T00:00:00.000Z", [pred()])).toBe(true);
    expect(hasInvalidLink("2026-08-10T00:00:00.000Z", [pred()])).toBe(false);
    expect(hasInvalidLink("2026-08-11T00:00:00.000Z", [pred()])).toBe(false);
  });

  it("ignores predecessors without a due date", () => {
    expect(hasInvalidLink("2026-01-01T00:00:00.000Z", [pred({ dueDate: null })])).toBe(false);
  });

  it("is false when the task has no start date", () => {
    expect(hasInvalidLink(null, [pred()])).toBe(false);
  });

  it("is false with no blockers", () => {
    expect(hasInvalidLink("2026-01-01T00:00:00.000Z", [])).toBe(false);
  });

  it("flags when any of several predecessors overlaps", () => {
    const blockers = [
      pred({ id: "a", title: "A", dueDate: "2026-08-01T00:00:00.000Z" }),
      pred({ id: "b", title: "B", dueDate: "2026-08-20T00:00:00.000Z" }),
    ];
    expect(hasInvalidLink("2026-08-15T00:00:00.000Z", blockers)).toBe(true);
  });
});
