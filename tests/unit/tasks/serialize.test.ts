import { describe, it, expect } from "vitest";
import { mapTaskListRow } from "@/lib/tasks/serialize";

describe("mapTaskListRow", () => {
  it("maps a task list row onto the TaskCard shape", () => {
    const mapped = mapTaskListRow({
      id: "t1",
      title: "Ship it",
      description: "do the thing",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-08-21T23:59:59.999Z",
      startDate: "2026-08-19T00:00:00.000Z",
      assignees: [{ id: "u1", displayName: "Alice", avatarUrl: null }],
      tags: [{ tag: { id: "tag1", name: "launch", color: "#f00" } }],
      _count: { subtasks: 3 },
    });

    expect(mapped).toEqual({
      id: "t1",
      title: "Ship it",
      description: "do the thing",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-08-21T23:59:59.999Z",
      startDate: "2026-08-19T00:00:00.000Z",
      assignees: [{ id: "u1", displayName: "Alice", avatarUrl: null }],
      tags: [{ id: "tag1", name: "launch" }],
      subtaskCount: 3,
      subtaskDone: 0,
    });
  });

  it("tolerates missing optional relations", () => {
    const mapped = mapTaskListRow({ id: "t2", title: "Minimal", status: "open", priority: "med" });
    expect(mapped.assignees).toEqual([]);
    expect(mapped.tags).toEqual([]);
    expect(mapped.dueDate).toBeNull();
    expect(mapped.description).toBeNull();
    expect(mapped.subtaskCount).toBe(0);
  });

  it("normalizes null avatarUrl", () => {
    const mapped = mapTaskListRow({
      id: "t3",
      title: "Avatar",
      status: "open",
      priority: "low",
      assignees: [{ id: "u2", displayName: "Bob" }],
    });
    expect(mapped.assignees[0]?.avatarUrl).toBeNull();
  });
});
