/**
 * Pure WBS view derivations — deliberately free of any Prisma/DB import so
 * client components (wbs-editor, wbs-tree) can consume them without bundling
 * the database client. The heavier tree-building module (`lib/tasks/wbs.ts`)
 * re-exports these for server-side callers.
 */

/**
 * The shape both WBS views derive search results from. `wbsCode` and
 * `projectName` are optional because the editor feeds `WbsNode`s (which carry
 * wbsCode) while the dashboard tree feeds `WBSTask`s (which carry
 * projectName).
 */
export type WbsSearchable = {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  assigneeNames: string[];
  wbsCode?: string;
  projectName?: string;
};

/**
 * Returns the ids visible under a search term: every node whose title, WBS
 * code, status, priority, project name, or assignee matches, plus all of its
 * ancestors so the matched row is reachable in the collapsed tree. Returns
 * null when the term is empty (no filtering).
 */
export function filterWbsBySearch(
  nodes: WbsSearchable[],
  term: string,
): Set<string> | null {
  const trimmed = term.trim().toLocaleLowerCase();
  if (!trimmed) return null;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ids = new Set<string>();
  for (const node of nodes) {
    const haystack = [
      node.title,
      node.wbsCode ?? "",
      node.status,
      node.priority,
      node.projectName ?? "",
      ...node.assigneeNames,
    ]
      .join(" ")
      .toLocaleLowerCase();
    if (!haystack.includes(trimmed)) continue;

    let current: WbsSearchable | undefined = node;
    while (current) {
      if (ids.has(current.id)) break;
      ids.add(current.id);
      current = current.parentTaskId ? nodeById.get(current.parentTaskId) : undefined;
    }
  }
  return ids;
}

/**
 * The leaf-weighted summary stats both WBS views render: group count (nodes
 * with children), completion count over leaves, and the leaf-weighted average
 * progress.
 */
export type WbsStats = {
  groupCount: number;
  leafCount: number;
  completedCount: number;
  averageProgress: number;
};

export function computeWbsStats(
  nodes: { id: string; status: string; progress?: number | null }[],
  isSummary: (_id: string) => boolean,
): WbsStats {
  const leaves = nodes.filter((node) => !isSummary(node.id));
  const completedCount = leaves.filter((node) => node.status === "done").length;
  const averageProgress = leaves.length === 0
    ? 0
    : Math.round(leaves.reduce((sum, node) => sum + (node.progress ?? 0), 0) / leaves.length);
  return {
    groupCount: nodes.length - leaves.length,
    leafCount: leaves.length,
    completedCount,
    averageProgress,
  };
}
