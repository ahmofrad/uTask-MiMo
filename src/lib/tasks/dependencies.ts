import { prisma } from "@/lib/db";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { notify } from "@/lib/notifications";
import { getInstanceSetting, DEFAULT_DEPENDENCY_ENFORCEMENT, type DependencyEnforcement } from "@/lib/settings/instance";

export type DependencyCode =
  | "SELF"
  | "DUPLICATE"
  | "CROSS_PROJECT"
  | "TASK_NOT_FOUND"
  | "TASK_DELETED"
  | "INVALID_TYPE"
  | "DEPENDENCY_CYCLE"
  | "DEPENDENCY_BLOCKED";

export class DependencyError extends Error {
  code: DependencyCode;
  status: number;
  details?: unknown;
  constructor(code: DependencyCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "DependencyError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Thrown when a status change is blocked by an incomplete predecessor. */
export class DependencyBlockedError extends DependencyError {
  blockers: { fs: number; ss: number; ff: number };
  constructor(blockers: { fs: number; ss: number; ff: number }) {
    super("DEPENDENCY_BLOCKED", "Status change blocked by incomplete dependencies", 403, blockers);
    this.blockers = blockers;
  }
}

export const DEPENDENCY_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
export type DependencyTypeValue = (typeof DEPENDENCY_TYPES)[number];

export type Edge = {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: DependencyTypeValue;
  lag: number;
  lagUnit: "DAY" | "HOUR";
  createdBy: string;
  predecessor: {
    id: string;
    title: string;
    status: string;
    startDate: Date | null;
    dueDate: Date | null;
    assigneeId: string | null;
  } | null;
  dependent: {
    id: string;
    title: string;
    status: string;
    assigneeId: string | null;
  } | null;
};

async function loadEdgeTasks(taskId: string, dependsOnId: string) {
  const [task, predecessor] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, deletedAt: true, title: true, status: true, assigneeId: true, startDate: true, dueDate: true },
    }),
    prisma.task.findUnique({
      where: { id: dependsOnId },
      select: { id: true, projectId: true, deletedAt: true, title: true, status: true, assigneeId: true },
    }),
  ]);
  return { task, predecessor };
}

/**
 * Adding `taskId -> dependsOnId` creates a cycle if `taskId` is already a
 * (transitive) predecessor of `dependsOnId`. Walk predecessors of `dependsOnId`
 * and look for `taskId`.
 */
export async function wouldCreateCycle(taskId: string, dependsOnId: string): Promise<boolean> {
  if (taskId === dependsOnId) return true;
  const queue = [dependsOnId];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current, deletedAt: null },
      select: { dependsOnId: true },
    });
    queue.push(...edges.map((e) => e.dependsOnId));
  }
  return false;
}

export async function addDependency(input: {
  taskId: string;
  dependsOnId: string;
  type?: DependencyTypeValue;
  lag?: number;
  lagUnit?: "DAY" | "HOUR";
  createdBy: string;
}): Promise<Edge> {
  const { task, predecessor } = await loadEdgeTasks(input.taskId, input.dependsOnId);

  if (!task || task.deletedAt) throw new DependencyError("TASK_NOT_FOUND", "Task not found");
  if (!predecessor || predecessor.deletedAt) throw new DependencyError("TASK_NOT_FOUND", "Predecessor task not found");
  if (input.taskId === input.dependsOnId) throw new DependencyError("SELF", "A task cannot depend on itself");
  if (task.projectId !== predecessor.projectId) {
    throw new DependencyError("CROSS_PROJECT", "Dependencies can only link tasks in the same project");
  }

  const type = (input.type ?? "FINISH_TO_START") as DependencyTypeValue;
  if (!DEPENDENCY_TYPES.includes(type)) {
    throw new DependencyError("INVALID_TYPE", "Unknown dependency type", 400);
  }

  const existing = await prisma.taskDependency.findFirst({
    where: { taskId: input.taskId, dependsOnId: input.dependsOnId, type, deletedAt: null },
  });
  if (existing) throw new DependencyError("DUPLICATE", "Dependency already exists", 409);

  if (await wouldCreateCycle(input.taskId, input.dependsOnId)) {
    throw new DependencyError("DEPENDENCY_CYCLE", "Dependency would create a cycle", 409);
  }

  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: { departmentId: true },
  });

  const created = await prisma.taskDependency.create({
    data: {
      taskId: input.taskId,
      dependsOnId: input.dependsOnId,
      type,
      lag: input.lag ?? 0,
      lagUnit: input.lagUnit ?? "DAY",
      teamId: project?.departmentId ?? null,
      createdBy: input.createdBy,
    },
    include: { dependsOn: { select: { id: true, title: true, status: true, startDate: true, dueDate: true, assigneeId: true } } },
  });

  await emitTaskEvent(
    "task.dependency_added",
    input.taskId,
    { taskId: input.taskId, dependsOnId: input.dependsOnId, type, lag: input.lag ?? 0 },
    input.createdBy,
  );

  return {
    id: created.id,
    taskId: created.taskId,
    dependsOnId: created.dependsOnId,
    type: created.type as DependencyTypeValue,
    lag: created.lag,
    lagUnit: created.lagUnit,
    createdBy: created.createdBy,
    predecessor: created.dependsOn
      ? {
          id: created.dependsOn.id,
          title: created.dependsOn.title,
          status: created.dependsOn.status,
          startDate: created.dependsOn.startDate,
          dueDate: created.dependsOn.dueDate,
          assigneeId: created.dependsOn.assigneeId,
        }
      : null,
    dependent: null,
  };
}

export async function removeDependency(taskId: string, dependsOnId: string, type?: DependencyTypeValue): Promise<void> {
  const where: Record<string, unknown> = { taskId, dependsOnId, deletedAt: null };
  if (type) where.type = type;

  const existing = await prisma.taskDependency.findFirst({ where });
  if (!existing) throw new DependencyError("TASK_NOT_FOUND", "Dependency not found", 404);

  await prisma.taskDependency.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
}

export async function listDependencies(taskId: string): Promise<{ outgoing: Edge[]; incoming: Edge[] }> {
  const [outgoingRaw, incomingRaw] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { taskId, deletedAt: null },
      include: {
        dependsOn: { select: { id: true, title: true, status: true, startDate: true, dueDate: true, assigneeId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.taskDependency.findMany({
      where: { dependsOnId: taskId, deletedAt: null },
      include: {
        task: { select: { id: true, title: true, status: true, assigneeId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const outgoing: Edge[] = outgoingRaw.map((e) => ({
    id: e.id,
    taskId: e.taskId,
    dependsOnId: e.dependsOnId,
    type: e.type as DependencyTypeValue,
    lag: e.lag,
    lagUnit: e.lagUnit,
    createdBy: e.createdBy,
    predecessor: e.dependsOn
      ? { id: e.dependsOn.id, title: e.dependsOn.title, status: e.dependsOn.status, startDate: e.dependsOn.startDate, dueDate: e.dependsOn.dueDate, assigneeId: e.dependsOn.assigneeId }
      : null,
    dependent: null,
  }));

  const incoming: Edge[] = incomingRaw.map((e) => ({
    id: e.id,
    taskId: e.taskId,
    dependsOnId: e.dependsOnId,
    type: e.type as DependencyTypeValue,
    lag: e.lag,
    lagUnit: e.lagUnit,
    createdBy: e.createdBy,
    predecessor: null,
    dependent: e.task
      ? { id: e.task.id, title: e.task.title, status: e.task.status, assigneeId: e.task.assigneeId }
      : null,
  }));

  return { outgoing, incoming };
}

export type BlockerCounts = { fs: number; ss: number; ff: number };

/**
 * Count incomplete predecessors that block `taskId` from moving to `nextStatus`,
 * using the status-based rules (date-agnostic). RELATES_TO never blocks.
 */
export async function countBlockersFor(taskId: string, nextStatus: string): Promise<BlockerCounts> {
  const edges = await prisma.taskDependency.findMany({
    where: { taskId, deletedAt: null },
    include: { dependsOn: { select: { id: true, status: true } } },
  });

  const counts: BlockerCounts = { fs: 0, ss: 0, ff: 0 };
  for (const edge of edges) {
    const a = edge.dependsOn?.status;
    if (!a || edge.type === "RELATES_TO") continue;
    if (edge.type === "FINISH_TO_START") {
      if ((nextStatus === "in_progress" || nextStatus === "done") && a !== "done") counts.fs++;
    } else if (edge.type === "START_TO_START") {
      if (nextStatus === "in_progress" && a === "open") counts.ss++;
    } else if (edge.type === "FINISH_TO_FINISH") {
      if (nextStatus === "done" && a !== "done") counts.ff++;
    }
  }
  return counts;
}

export async function getEnforcementMode(): Promise<DependencyEnforcement> {
  const value = await getInstanceSetting<DependencyEnforcement>("tasks.dependencyEnforcement", DEFAULT_DEPENDENCY_ENFORCEMENT);
  if (value === "off" || value === "warn" || value === "block") return value;
  return DEFAULT_DEPENDENCY_ENFORCEMENT;
}

/**
 * Returns whether the status change is allowed. In `warn` mode the change is
 * allowed but `warn` is set so the caller can surface an advisory. In `block`
 * mode incomplete predecessors reject the change.
 */
export async function evaluateStatusChange(taskId: string, nextStatus: string): Promise<{ allowed: boolean; warn: boolean; blockers: BlockerCounts }> {
  const mode = await getEnforcementMode();
  if (mode === "off") return { allowed: true, warn: false, blockers: { fs: 0, ss: 0, ff: 0 } };
  const blockers = await countBlockersFor(taskId, nextStatus);
  const total = blockers.fs + blockers.ss + blockers.ff;
  if (total > 0 && mode === "block") return { allowed: false, warn: false, blockers };
  return { allowed: true, warn: total > 0, blockers };
}

/**
 * When `taskId` reaches a status that may free its dependents, notify anyone
 * whose blockers just dropped to zero.
 */
export async function notifyUnblocked(taskId: string, actorUserId: string): Promise<void> {
  const incoming = await prisma.taskDependency.findMany({
    where: { dependsOnId: taskId, deletedAt: null, type: { not: "RELATES_TO" } },
    include: { task: { select: { id: true, title: true, status: true, assigneeId: true, projectId: true } } },
  });

  for (const edge of incoming) {
    const dependent = edge.task;
    if (dependent.status === "done" || dependent.status === "cancelled") continue;
    const remaining = await countBlockersFor(dependent.id, dependent.status);
    const total = remaining.fs + remaining.ss + remaining.ff;
    if (total > 0) continue;

    const predecessor = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });

    if (dependent.assigneeId) {
      await notify({
        userId: dependent.assigneeId,
        type: "unblocked",
        taskId: dependent.id,
        payload: { taskTitle: dependent.title, predecessorTitle: predecessor?.title ?? "" },
      });
    }

    await emitTaskEvent(
      "task.unblocked",
      dependent.id,
      { taskId: dependent.id, unblockedBy: taskId, title: dependent.title },
      actorUserId,
    );
  }
}
