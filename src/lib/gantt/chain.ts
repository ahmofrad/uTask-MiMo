import type { GanttLink, GanttRow } from "@/lib/gantt-types";

/**
 * Incoming dependency edges of a task whose source is also on the critical
 * chain — the direct links that pull the task onto the critical path.
 */
export function criticalPredecessors(
  links: GanttLink[],
  criticalIds: ReadonlySet<string>,
  taskId: string,
): GanttLink[] {
  return links.filter((l) => l.target === taskId && criticalIds.has(l.source));
}

/**
 * Critical rows nested anywhere under a summary (transitive closure over the
 * WBS children map) — the sub-chain that makes the summary critical. Returns
 * only rows whose own `critical` flag is true, so rolled-up critical
 * summaries appear too (they carry the flag set by the report).
 */
export function criticalDescendants(rows: GanttRow[], summaryId: string): GanttRow[] {
  const childrenMap = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentTaskId) continue;
    const list = childrenMap.get(row.parentTaskId) ?? [];
    list.push(row.id);
    childrenMap.set(row.parentTaskId, list);
  }
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const result: GanttRow[] = [];
  const seen = new Set<string>();
  const stack = [...(childrenMap.get(summaryId) ?? [])];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    const child = rowById.get(currentId);
    if (child?.critical === true) result.push(child);
    stack.push(...(childrenMap.get(currentId) ?? []));
  }
  return result;
}
