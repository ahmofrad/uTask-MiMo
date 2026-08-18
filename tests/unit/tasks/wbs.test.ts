import { describe, it, expect } from "vitest";
import {
  buildWbsTree,
  computeWbsStats,
  filterWbsBySearch,
  hasCycle,
  ancestorDepth,
  subtreeMaxRelativeDepth,
  MAX_WBS_DEPTH,
  type WbsSearchable,
  type WbsSourceTask,
  type ParentMaps,
} from "@/lib/tasks/wbs";

function task(id: string, parentTaskId: string | null, over: Partial<WbsSourceTask> = {}): WbsSourceTask {
  return {
    id,
    title: id,
    status: "open",
    priority: "med",
    parentTaskId,
    assigneeId: null,
    progress: 0,
    estimatedHours: null,
    orderIndex: Number(id),
    deletedAt: null,
    ...over,
  };
}

function mapsFrom(parents: Record<string, string | null>): ParentMaps {
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string | null, string[]>();
  for (const [id, pid] of Object.entries(parents)) {
    parentMap.set(id, pid);
    const arr = childrenMap.get(pid) ?? [];
    arr.push(id);
    childrenMap.set(pid, arr);
  }
  return { parentMap, childrenMap };
}

describe("buildWbsTree", () => {
  it("assigns wbs codes, depth, isSummary and childCount in DFS pre-order", () => {
    // a (root) -> b, c ; b -> d
    const tasks = [
      task("a", null, { orderIndex: 1 }),
      task("b", "a", { orderIndex: 2 }),
      task("c", "a", { orderIndex: 3 }),
      task("d", "b", { orderIndex: 4 }),
    ];
    const tree = buildWbsTree(tasks);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(tree.map((n) => n.id)).toEqual(["a", "b", "d", "c"]);
    expect(byId.a.wbsCode).toBe("1");
    expect(byId.a.depth).toBe(0);
    expect(byId.a.isSummary).toBe(true);
    expect(byId.a.childCount).toBe(2);
    expect(byId.b.wbsCode).toBe("1.1");
    expect(byId.b.depth).toBe(1);
    expect(byId.d.wbsCode).toBe("1.1.1");
    expect(byId.d.depth).toBe(2);
    expect(byId.d.isSummary).toBe(false);
    expect(byId.c.wbsCode).toBe("1.2");
  });

  it("computes rollup as count-weighted average of leaf progress", () => {
    const tasks = [
      task("a", null),
      task("b", "a", { progress: 100 }),
      task("c", "a", { progress: 0 }),
    ];
    const tree = buildWbsTree(tasks);
    const a = tree.find((n) => n.id === "a")!;
    expect(a.rollupPercent).toBe(50);
  });

  it("weights rollup by estimatedHours when present", () => {
    const tasks = [
      task("a", null),
      task("b", "a", { progress: 100, estimatedHours: 3 }),
      task("c", "a", { progress: 0, estimatedHours: 1 }),
    ];
    const tree = buildWbsTree(tasks);
    const a = tree.find((n) => n.id === "a")!;
    // (100*3 + 0*1) / 4 = 75
    expect(a.rollupPercent).toBe(75);
  });

  it("returns a leaf's own progress as its rollup", () => {
    const tree = buildWbsTree([task("x", null, { progress: 40 })]);
    expect(tree[0].rollupPercent).toBe(40);
  });
});

describe("filterWbsBySearch", () => {
  const nodes: WbsSearchable[] = [
    { id: "a", title: "Design API", status: "open", priority: "high", parentTaskId: null, assigneeNames: ["Sara"] },
    { id: "b", title: "Build server", status: "in_progress", priority: "med", parentTaskId: "a", assigneeNames: ["Ali"], wbsCode: "1.1" },
    { id: "c", title: "Ship v1", status: "open", priority: "low", parentTaskId: "b", assigneeNames: [], wbsCode: "1.1.1" },
  ];

  it("returns null for an empty term (no filtering)", () => {
    expect(filterWbsBySearch(nodes, "  ")).toBeNull();
  });

  it("matches titles case-insensitively", () => {
    const ids = filterWbsBySearch(nodes, "SERVER");
    expect(ids?.has("b")).toBe(true);
  });

  it("matches assignee names and wbs codes", () => {
    expect(filterWbsBySearch(nodes, "sara")?.has("a")).toBe(true);
    expect(filterWbsBySearch(nodes, "1.1.1")?.has("c")).toBe(true);
  });

  it("includes ancestors so the match is reachable in a collapsed tree", () => {
    const ids = filterWbsBySearch(nodes, "ship");
    expect(ids?.has("c")).toBe(true);
    expect(ids?.has("b")).toBe(true); // parent
    expect(ids?.has("a")).toBe(true); // grandparent
  });

  it("matches project names when present", () => {
    const withProject = [
      { ...nodes[0]!, projectName: "Marketing" },
      nodes[1]!,
      nodes[2]!,
    ];
    expect(filterWbsBySearch(withProject, "marketing")?.has("a")).toBe(true);
  });
});

describe("computeWbsStats", () => {
  const nodes = [
    { id: "a", status: "open", progress: 0 },          // summary (has child)
    { id: "b", status: "done", progress: 100 },        // leaf
    { id: "c", status: "in_progress", progress: 50 },  // leaf
    { id: "d", status: "open", progress: 20 },         // leaf
  ];
  const isSummary = (id: string) => id === "a";

  it("counts leaves, groups and completed leaves", () => {
    const stats = computeWbsStats(nodes, isSummary);
    expect(stats.groupCount).toBe(1);
    expect(stats.leafCount).toBe(3);
    expect(stats.completedCount).toBe(1);
  });

  it("averages progress over leaves only (rounded)", () => {
    const stats = computeWbsStats(nodes, isSummary);
    expect(stats.averageProgress).toBe(Math.round((100 + 50 + 20) / 3));
  });

  it("returns zero progress when there are no leaves", () => {
    const stats = computeWbsStats([{ id: "a", status: "open", progress: 0 }], isSummary);
    expect(stats.leafCount).toBe(0);
    expect(stats.averageProgress).toBe(0);
    expect(stats.completedCount).toBe(0);
  });

  it("treats missing progress as zero", () => {
    const stats = computeWbsStats(
      [{ id: "x", status: "open", progress: undefined }],
      () => false,
    );
    expect(stats.averageProgress).toBe(0);
  });
});

describe("wbs guards", () => {
  it("hasCycle detects when target is a descendant", () => {
    const m = mapsFrom({ a: null, b: "a", c: "b" });
    expect(hasCycle(m, "a", "c")).toBe(true);
    expect(hasCycle(m, "a", null)).toBe(false);
    expect(hasCycle(m, "a", "a")).toBe(true);
  });

  it("ancestorDepth counts chain length", () => {
    const m = mapsFrom({ a: null, b: "a", c: "b" });
    expect(ancestorDepth(m, "c")).toBe(2);
    expect(ancestorDepth(m, "a")).toBe(0);
  });

  it("subtreeMaxRelativeDepth measures depth below a node", () => {
    const m = mapsFrom({ a: null, b: "a", c: "b", d: "c" });
    expect(subtreeMaxRelativeDepth(m.childrenMap, "a")).toBe(3);
    expect(subtreeMaxRelativeDepth(m.childrenMap, "b")).toBe(2);
    expect(subtreeMaxRelativeDepth(m.childrenMap, "d")).toBe(0);
  });

  it("exposes the configured depth limit", () => {
    expect(MAX_WBS_DEPTH).toBe(20);
  });
});
