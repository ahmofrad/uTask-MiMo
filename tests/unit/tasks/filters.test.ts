import { describe, it, expect } from "vitest";

import { buildTaskFilters, type TaskFilterParams } from "@/lib/tasks/filters";

describe("buildTaskFilters", () => {
  it("includes deletedAt null and parentTaskId null by default", () => {
    const result = buildTaskFilters({});
    expect(result.deletedAt).toBeNull();
    expect(result.parentTaskId).toBeNull();
  });

  it("adds projectId filter", () => {
    const result = buildTaskFilters({ projectId: "proj-1" });
    expect(result.projectId).toBe("proj-1");
  });

  it("adds assigneeId filter (single alias)", () => {
    const result = buildTaskFilters({ assigneeId: "user-1" });
    expect(result.assignees).toEqual({ some: { userId: "user-1" } });
  });

  it("adds assigneeIds filter (multi)", () => {
    const result = buildTaskFilters({ assigneeIds: ["user-1", "user-2"] });
    expect(result.assignees).toEqual({ some: { userId: { in: ["user-1", "user-2"] } } });
  });

  it("adds status filter", () => {
    const result = buildTaskFilters({ status: "open" });
    expect(result.status).toBe("open");
  });

  it("adds priority filter", () => {
    const result = buildTaskFilters({ priority: "high" });
    expect(result.priority).toBe("high");
  });

  it("adds dueDate range filter with gte only", () => {
    const result = buildTaskFilters({ dueDateGte: "2024-01-01" });
    expect(result.dueDate).toEqual({
      gte: new Date("2024-01-01"),
    });
  });

  it("adds dueDate range filter with lte only", () => {
    const result = buildTaskFilters({ dueDateLte: "2024-12-31" });
    expect(result.dueDate).toEqual({
      lte: new Date("2024-12-31"),
    });
  });

  it("adds dueDate range filter with both bounds", () => {
    const result = buildTaskFilters({
      dueDateGte: "2024-01-01",
      dueDateLte: "2024-12-31",
    });
    expect(result.dueDate).toEqual({
      gte: new Date("2024-01-01"),
      lte: new Date("2024-12-31"),
    });
  });

  it("does not add dueDate when both bounds are null", () => {
    const result = buildTaskFilters({});
    expect(result.dueDate).toBeUndefined();
  });

  it("adds search filter with OR on title and description", () => {
    const result = buildTaskFilters({ search: "bug fix" });
    expect(result.OR).toEqual([
      { title: { contains: "bug fix", mode: "insensitive" } },
      { description: { contains: "bug fix", mode: "insensitive" } },
    ]);
  });

  it("combines multiple filters", () => {
    const result = buildTaskFilters({
      projectId: "proj-1",
      status: "open",
      priority: "high",
      assigneeId: "user-1",
    });
    expect(result).toEqual({
      deletedAt: null,
      parentTaskId: null,
      projectId: "proj-1",
      status: "open",
      priority: "high",
      assignees: { some: { userId: "user-1" } },
    });
  });

  it("null assigneeId means no assignees", () => {
    const result = buildTaskFilters({
      projectId: null,
      assigneeId: null,
      status: null,
    });
    expect(result.projectId).toBeUndefined();
    expect(result.assigneeId).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.assignees).toEqual({ none: {} });
  });
});
