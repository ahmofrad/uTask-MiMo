import { prisma } from "@/lib/db";
import {
  computeWbsStats,
  filterWbsBySearch,
  type WbsSearchable,
  type WbsStats,
} from "@/lib/tasks/wbs-stats";

export { computeWbsStats, filterWbsBySearch };
export type { WbsSearchable, WbsStats };

export const MAX_WBS_DEPTH = 20;

const ORDER_STEP = 1000;

export type WbsGuardCode =
  | "SELF_PARENT"
  | "CYCLE"
  | "MAX_DEPTH"
  | "CROSS_PROJECT"
  | "TASK_SCOPE"
  | "PARENT_DELETED"
  | "PARENT_NOT_FOUND";

export class WbsGuardError extends Error {
  code: WbsGuardCode;
  constructor(code: WbsGuardCode, message: string) {
    super(message);
    this.name = "WbsGuardError";
    this.code = code;
  }
}

export type WbsSourceTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  progress: number;
  estimatedHours: number | null;
  orderIndex: number | null;
  deletedAt: Date | null;
};

export type WbsNode = {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  progress: number;
  estimatedHours: number | null;
  depth: number;
  wbsCode: string;
  isSummary: boolean;
  childCount: number;
  rollupPercent: number;
  orderIndex: number | null;
};

export type ParentMaps = {
  parentMap: Map<string, string | null>;
  childrenMap: Map<string | null, string[]>;
};



/**
 * Load all (non-deleted) tasks of a project as id -> parentTaskId plus a
 * children adjacency map. Used for in-memory cycle / depth checks.
 */
export async function loadProjectParentMaps(projectId: string): Promise<ParentMaps> {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, parentTaskId: true },
  });

  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string | null, string[]>();
  for (const t of tasks) {
    parentMap.set(t.id, t.parentTaskId);
    const arr = childrenMap.get(t.parentTaskId) ?? [];
    arr.push(t.id);
    childrenMap.set(t.parentTaskId, arr);
  }
  return { parentMap, childrenMap };
}

export function hasCycle(
  { parentMap }: ParentMaps,
  taskId: string,
  newParentId: string | null,
): boolean {
  if (newParentId == null) return false;
  if (taskId === newParentId) return true;

  let current: string | null = newParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === taskId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentMap.get(current) ?? null;
  }
  return false;
}

export function ancestorDepth({ parentMap }: ParentMaps, id: string): number {
  let current = parentMap.get(id) ?? null;
  let depth = 0;
  const visited = new Set<string>();
  while (current) {
    depth += 1;
    if (visited.has(current)) break;
    visited.add(current);
    current = parentMap.get(current) ?? null;
  }
  return depth;
}

export function subtreeMaxRelativeDepth(
  childrenMap: Map<string | null, string[]>,
  id: string,
): number {
  const children = childrenMap.get(id) ?? [];
  if (children.length === 0) return 0;
  let max = 0;
  for (const childId of children) {
    max = Math.max(max, 1 + subtreeMaxRelativeDepth(childrenMap, childId));
  }
  return max;
}

/**
 * Compute a fractional orderIndex that places a node at `position` among the
 * siblings of `parentTaskId` (0-based). Appends at the end when position is
 * out of range. A child is placed just after its parent in global order so the
 * tree reads top-to-bottom in DFS order.
 */
export async function computeSiblingOrderIndex(
  projectId: string,
  parentTaskId: string | null,
  position: number,
): Promise<number> {
  const siblings = await prisma.task.findMany({
    where: { projectId, parentTaskId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { orderIndex: true },
  });

  const orderValues = siblings.map((s) => Number(s.orderIndex ?? 0));
  const idx = Math.max(0, Math.min(position, orderValues.length));

  if (orderValues.length === 0) {
    if (parentTaskId) {
      const parent = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { orderIndex: true },
      });
      return Number(parent?.orderIndex ?? 0) + ORDER_STEP / 2;
    }
    return ORDER_STEP;
  }

  if (idx === 0) return (orderValues[0] ?? 0) - ORDER_STEP / 2;
  if (idx >= orderValues.length) return (orderValues[orderValues.length - 1] ?? 0) + ORDER_STEP;

  const before = orderValues[idx - 1] ?? 0;
  const after = orderValues[idx] ?? 0;
  return (before + after) / 2;
}

function computeRollup(
  task: WbsSourceTask,
  childrenMap: Map<string, WbsSourceTask[]>,
): number {
  const children = childrenMap.get(task.id) ?? [];
  if (children.length === 0) return task.progress;

  let weighted = 0;
  let totalWeight = 0;
  for (const child of children) {
    const childRollup = computeRollup(child, childrenMap);
    const weight = child.estimatedHours && child.estimatedHours > 0 ? child.estimatedHours : 1;
    weighted += childRollup * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

/**
 * Build a flat DFS pre-order list of WBS nodes with derived wbsCode, depth,
 * isSummary, childCount and rollupPercent (leaf-weighted average of progress,
 * weighted by estimatedHours when present).
 */
export function buildWbsTree(tasks: WbsSourceTask[]): WbsNode[] {
  const childrenMap = new Map<string, WbsSourceTask[]>();
  for (const t of tasks) {
    const arr = childrenMap.get(t.parentTaskId ?? "") ?? [];
    arr.push(t);
    childrenMap.set(t.parentTaskId ?? "", arr);
  }
  for (const arr of childrenMap.values()) {
    arr.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  const roots = childrenMap.get("") ?? [];
  const result: WbsNode[] = [];

  const visit = (task: WbsSourceTask, depth: number, code: string) => {
    const children = childrenMap.get(task.id) ?? [];
    const isSummary = children.length > 0;
    result.push({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      parentTaskId: task.parentTaskId,
      assigneeIds: task.assigneeIds,
      assigneeNames: task.assigneeNames,
      progress: task.progress,
      estimatedHours: task.estimatedHours,
      depth,
      wbsCode: code,
      isSummary,
      childCount: children.length,
      rollupPercent: Math.round(computeRollup(task, childrenMap)),
      orderIndex: task.orderIndex,
    });
    children.forEach((child, i) => visit(child, depth + 1, `${code}.${i + 1}`));
  };

  roots.forEach((root, i) => visit(root, 0, `${i + 1}`));
  return result;
}

export async function getWbsForProject(projectId: string): Promise<WbsNode[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      parentTaskId: true,
      assignees: { include: { user: { select: { displayName: true } } } },
      progress: true,
      estimatedHours: true,
      orderIndex: true,
      deletedAt: true,
    },
    orderBy: { orderIndex: "asc" },
  });

  const source: WbsSourceTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    parentTaskId: t.parentTaskId,
    assigneeIds: t.assignees.map((a) => a.userId),
    assigneeNames: t.assignees.map((a) => a.user.displayName),
    progress: t.progress,
    estimatedHours: t.estimatedHours != null ? Number(t.estimatedHours) : null,
    orderIndex: t.orderIndex != null ? Number(t.orderIndex) : null,
    deletedAt: t.deletedAt,
  }));

  return buildWbsTree(source);
}
