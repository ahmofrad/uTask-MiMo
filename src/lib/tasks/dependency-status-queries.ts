import { prisma } from "@/lib/db";
import type { PredecessorInfo, TaskDependencyStatus } from "@/lib/tasks/dependency-status";

/**
 * For every task in the given projects, the list of its *incomplete*
 * predecessors (non-RELATES edges whose predecessor is not done/cancelled).
 * This powers the blocked indicators on boards and the dependency warnings in
 * list views. Dependencies only link tasks inside one project, so querying by
 * project is exact. Server-only: imports the Prisma client.
 */
export async function getProjectDependencyStatusMap(
  projectIds: string[],
): Promise<Map<string, TaskDependencyStatus>> {
  const map = new Map<string, TaskDependencyStatus>();
  if (projectIds.length === 0) return map;

  const edges = await prisma.taskDependency.findMany({
    where: {
      deletedAt: null,
      type: { not: "RELATES_TO" },
      task: { projectId: { in: projectIds }, deletedAt: null },
      dependsOn: { deletedAt: null },
    },
    select: {
      taskId: true,
      dependsOn: { select: { id: true, title: true, status: true, startDate: true, dueDate: true } },
    },
  });

  for (const edge of edges) {
    const predecessor = edge.dependsOn;
    if (!predecessor) continue;
    if (predecessor.status === "done" || predecessor.status === "cancelled") continue;
    const entry = map.get(edge.taskId) ?? { blockedBy: [] as PredecessorInfo[] };
    entry.blockedBy.push({
      id: predecessor.id,
      title: predecessor.title,
      status: predecessor.status,
      startDate: predecessor.startDate?.toISOString() ?? null,
      dueDate: predecessor.dueDate?.toISOString() ?? null,
    });
    map.set(edge.taskId, entry);
  }
  return map;
}
