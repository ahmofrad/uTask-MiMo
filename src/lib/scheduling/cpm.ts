import { prisma } from "@/lib/db";
import { DependencyError } from "@/lib/tasks/dependencies";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type CpmNode = {
  id: string;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  isMilestone: boolean;
  progress: number;
  status: string;
};

export type CpmScheduleEntry = {
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  critical: boolean;
  unscheduled: boolean;
};

export type CpmResult = {
  schedule: Record<string, CpmScheduleEntry>;
  criticalChain: string[];
  start: number | null;
  end: number | null;
  scheduleVersion: number;
};

type Edge = { from: string; to: string; type: string; lagMs: number };

function lagToMs(lag: number, unit: string): number {
  if (unit === "HOUR") return lag * HOUR_MS;
  return lag * DAY_MS;
}

/** Duration in ms for a schedulable leaf. Returns null when it cannot be scheduled. */
function durationMs(node: CpmNode): number | null {
  if (node.isMilestone) return 0;
  const hasStart = !!node.startDate;
  const hasDue = !!node.dueDate;
  if (hasStart && hasDue) {
    const d = node.dueDate!.getTime() - node.startDate!.getTime() + DAY_MS;
    return Math.max(d, DAY_MS);
  }
  const est = node.estimatedHours ?? null;
  if (hasStart && est != null) {
    return Math.max((est / 8) * DAY_MS, DAY_MS);
  }
  if (hasDue && est != null) {
    return Math.max((est / 8) * DAY_MS, DAY_MS);
  }
  if (hasDue && !hasStart) {
    // Finish-only constraint: assume a one-day effort ending on dueDate.
    return DAY_MS;
  }
  return null;
}

const cache = new Map<string, { version: number; result: CpmResult }>();

export async function computeSchedule(projectId: string): Promise<CpmResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { scheduleVersion: true },
  });
  const version = project?.scheduleVersion ?? 0;

  const cached = cache.get(projectId);
  if (cached && cached.version === version) return cached.result;

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      parentTaskId: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
      isMilestone: true,
      progress: true,
      status: true,
    },
  });

  const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!));
  const leaves = tasks.filter((t) => !parentIds.has(t.id));

  const nodeById = new Map<string, CpmNode>();
  for (const t of leaves) {
    nodeById.set(t.id, {
      id: t.id,
      startDate: t.startDate,
      dueDate: t.dueDate,
      estimatedHours: t.estimatedHours != null ? Number(t.estimatedHours) : null,
      isMilestone: t.isMilestone,
      progress: t.progress,
      status: t.status,
    });
  }

  const deps = await prisma.taskDependency.findMany({
    where: {
      deletedAt: null,
      taskId: { in: leaves.map((l) => l.id) },
      dependsOnId: { in: leaves.map((l) => l.id) },
    },
    select: { taskId: true, dependsOnId: true, type: true, lag: true, lagUnit: true },
  });

  const edges: Edge[] = deps
    .filter((d) => d.type !== "RELATES_TO")
    .map((d) => ({
      from: d.dependsOnId,
      to: d.taskId,
      type: d.type,
      lagMs: lagToMs(d.lag, d.lagUnit),
    }));

  const result = runCpm(nodeById, edges, version);
  cache.set(projectId, { version, result });
  return result;
}

function runCpm(nodes: Map<string, CpmNode>, edges: Edge[], version: number): CpmResult {
  const ids = Array.from(nodes.keys());
  const dur = new Map<string, number>();
  for (const id of ids) {
    const d = durationMs(nodes.get(id)!);
    dur.set(id, d ?? 0);
  }

  // Incoming / outgoing adjacency
  const incoming = new Map<string, Edge[]>();
  const outgoing = new Map<string, Edge[]>();
  for (const e of edges) {
    (incoming.get(e.to) ?? incoming.set(e.to, []).get(e.to)!).push(e);
    (outgoing.get(e.from) ?? outgoing.set(e.from, []).get(e.from)!).push(e);
  }

  // Topological sort (Kahn)
  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const topo: string[] = [];
  const indegWork = new Map(indeg);
  while (queue.length) {
    const n = queue.shift()!;
    topo.push(n);
    for (const e of outgoing.get(n) ?? []) {
      const d = (indegWork.get(e.to) ?? 0) - 1;
      indegWork.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  if (topo.length !== ids.length) {
    throw new DependencyError("DEPENDENCY_CYCLE", "Dependency cycle detected in schedule", 409);
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  // Forward pass
  for (const id of topo) {
    const node = nodes.get(id)!;
    const d = dur.get(id)!;
    let earliest = -Infinity;
    for (const e of incoming.get(id) ?? []) {
      const aEs = es.get(e.from)!;
      const aEf = ef.get(e.from)!;
      if (e.type === "FINISH_TO_START") earliest = Math.max(earliest, aEf + e.lagMs);
      else if (e.type === "START_TO_START") earliest = Math.max(earliest, aEs + e.lagMs);
      else if (e.type === "FINISH_TO_FINISH") earliest = Math.max(earliest, aEf + e.lagMs - d);
    }
    const explicitStart = node.startDate ? node.startDate.getTime() : null;
    // A finish-only task (due date, no pinned start) is scheduled back from
    // its deadline so it lands exactly on the due date; a milestone sits on
    // its due date. Without this, unconstrained sources anchor at day zero
    // and real due dates never constrain the schedule.
    const deadlineStart =
      explicitStart == null && node.dueDate != null ? node.dueDate.getTime() - d : null;
    let start = earliest === -Infinity ? (explicitStart ?? deadlineStart ?? 0) : earliest;
    if (explicitStart !== null) start = Math.max(start, explicitStart);
    if (deadlineStart !== null) start = Math.max(start, deadlineStart);
    es.set(id, start);
    ef.set(id, start + d);
  }

  const projectEnd = ids.length ? Math.max(...ids.map((id) => ef.get(id)!)) : 0;
  const projectStart = ids.length ? Math.min(...ids.map((id) => es.get(id)!)) : 0;

  const lf = new Map<string, number>();
  const ls = new Map<string, number>();

  // Backward pass (reverse topo)
  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i];
    if (id === undefined) continue;
    const d = dur.get(id)!;
    const node = nodes.get(id)!;
    const hasOut = (outgoing.get(id) ?? []).length > 0;
    let latest = hasOut ? Infinity : projectEnd;
    for (const e of outgoing.get(id) ?? []) {
      const bLs = ls.get(e.to)!;
      const bLf = lf.get(e.to)!;
      if (e.type === "FINISH_TO_START") latest = Math.min(latest, bLs - e.lagMs);
      else if (e.type === "START_TO_START") latest = Math.min(latest, bLs - e.lagMs + d);
      else if (e.type === "FINISH_TO_FINISH") latest = Math.min(latest, bLf - e.lagMs);
    }
    // A finish-only task must finish by its due date — the deadline is a
    // hard latest-finish, so tasks scheduled against a tight deadline get
    // zero (or negative) float instead of slack against the project end.
    if (node.dueDate != null && node.startDate == null) {
      latest = Math.min(latest, node.dueDate.getTime());
    }
    lf.set(id, latest);
    ls.set(id, latest - d);
  }

  const schedule: Record<string, CpmScheduleEntry> = {};
  const criticalChain: string[] = [];
  for (const id of topo) {
    const d = dur.get(id)!;
    const float = ls.get(id)! - es.get(id)!;
    const unscheduled =
      d === 0 &&
      !nodes.get(id)!.startDate &&
      !nodes.get(id)!.dueDate &&
      !nodes.get(id)!.estimatedHours;
    // A completed task is history — it no longer drives the schedule, so it
    // is never flagged critical (matches the chart's overdue indicator).
    const critical = !unscheduled && nodes.get(id)!.status !== "done" && float <= HOUR_MS;
    schedule[id] = {
      es: es.get(id)!,
      ef: ef.get(id)!,
      ls: ls.get(id)!,
      lf: lf.get(id)!,
      float,
      critical,
      unscheduled,
    };
    if (critical) criticalChain.push(id);
  }

  return {
    schedule,
    criticalChain,
    start: ids.length ? projectStart : null,
    end: ids.length ? projectEnd : null,
    scheduleVersion: version,
  };
}

export function invalidateScheduleCache(projectId: string): void {
  cache.delete(projectId);
}

export async function bumpScheduleVersion(projectId: string): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { scheduleVersion: { increment: 1 } },
  });
  cache.delete(projectId);
}
