import { describe, it, expect } from "vitest";
import { criticalDescendants, criticalPredecessors } from "@/lib/gantt/chain";
import type { GanttLink, GanttRow } from "@/lib/gantt-types";

function row(id: string, extra: Partial<GanttRow> = {}): GanttRow {
  return {
    id,
    title: id,
    wbsCode: id,
    parentTaskId: null,
    depth: 0,
    isSummary: false,
    isMilestone: false,
    status: "open",
    progress: 0,
    startDate: null,
    dueDate: null,
    ...extra,
  };
}

function link(source: string, target: string, type = "FINISH_TO_START"): GanttLink {
  return { id: `${source}-${target}`, source, target, type, lag: 0, lagUnit: "DAY" };
}

describe("criticalPredecessors", () => {
  const links = [
    link("a", "b"),
    link("c", "b"),
    link("d", "b"),
    link("a", "e"),
  ];
  const criticalIds = new Set(["a", "c"]);

  it("returns only edges whose source is on the critical chain", () => {
    const result = criticalPredecessors(links, criticalIds, "b");
    expect(result.map((l) => l.source)).toEqual(["a", "c"]);
  });

  it("keeps the full edge payload on returned predecessors", () => {
    const result = criticalPredecessors(links, criticalIds, "e");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: "a", target: "e" });
  });

  it("returns an empty list when no critical predecessor links into the task", () => {
    // "a" has no incoming edges at all; "missing" is unknown.
    expect(criticalPredecessors(links, criticalIds, "a")).toEqual([]);
    expect(criticalPredecessors(links, criticalIds, "missing")).toEqual([]);
  });
});

describe("criticalDescendants", () => {
  //   root (summary)
  //    ├─ child1 (summary, critical via rollup)
  //    │   └─ grandchild1 (critical)
  //    │   └─ grandchild2 (not critical)
  //    └─ child2 (not critical)
  const rows: GanttRow[] = [
    row("root", { isSummary: true }),
    row("child1", { parentTaskId: "root", isSummary: true, critical: true }),
    row("grandchild1", { parentTaskId: "child1", critical: true }),
    row("grandchild2", { parentTaskId: "child1" }),
    row("child2", { parentTaskId: "root" }),
    row("unrelated"),
  ];

  it("collects critical rows transitively under the summary", () => {
    const result = criticalDescendants(rows, "root");
    expect(result.map((r) => r.id).sort()).toEqual(["child1", "grandchild1"].sort());
  });

  it("includes rolled-up critical summaries nested inside", () => {
    const withNestedSummary = [
      ...rows,
      row("inner-summary", { parentTaskId: "child1", isSummary: true, critical: true }),
      row("deep-leaf", { parentTaskId: "inner-summary", critical: true }),
    ];
    const result = criticalDescendants(withNestedSummary, "root");
    expect(result.map((r) => r.id)).toContain("inner-summary");
    expect(result.map((r) => r.id)).toContain("deep-leaf");
  });

  it("returns an empty list for a leaf or unknown summary", () => {
    expect(criticalDescendants(rows, "child2")).toEqual([]);
    expect(criticalDescendants(rows, "missing")).toEqual([]);
  });
});
