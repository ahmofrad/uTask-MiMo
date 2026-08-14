import { prisma } from "@/lib/db";
import { getWbsForProject } from "@/lib/tasks";
import { computeSchedule } from "@/lib/scheduling/cpm";
import type { GanttLink, GanttReport, GanttRow } from "@/lib/gantt-types";

export async function buildGanttReport(
  projectId: string,
  withCritical: boolean,
): Promise<GanttReport> {
  const tree = await getWbsForProject(projectId);
  const dateRows = await prismaDateRows(projectId);
  const schedule = await computeSchedule(projectId);

  const childrenMap = new Map<string | null, string[]>();
  for (const node of tree) {
    const children = childrenMap.get(node.parentTaskId) ?? [];
    children.push(node.id);
    childrenMap.set(node.parentTaskId, children);
  }

  const tasks: GanttRow[] = tree.map((node) => {
    const dates = dateRows.get(node.id);
    const startDate = dates?.startDate?.toISOString() ?? null;
    const dueDate = dates?.dueDate?.toISOString() ?? null;
    const scheduleEntry = schedule.schedule[node.id];
    const critical = withCritical && scheduleEntry && !scheduleEntry.unscheduled
      ? scheduleEntry.critical
      : undefined;

    let summaryStart: string | null = null;
    let summaryEnd: string | null = null;
    if (node.isSummary) {
      const descendants = collectDescendants(node.id, childrenMap);
      let minimum: number | null = null;
      let maximum: number | null = null;
      for (const descendantId of descendants) {
        const descendantDates = dateRows.get(descendantId);
        if (descendantDates?.startDate) {
          minimum = minimum == null
            ? descendantDates.startDate.getTime()
            : Math.min(minimum, descendantDates.startDate.getTime());
        }
        if (descendantDates?.dueDate) {
          maximum = maximum == null
            ? descendantDates.dueDate.getTime()
            : Math.max(maximum, descendantDates.dueDate.getTime());
        }
      }
      if (minimum == null && scheduleEntry) minimum = schedule.start;
      if (maximum == null && scheduleEntry) maximum = schedule.end;
      summaryStart = minimum != null ? new Date(minimum).toISOString() : null;
      summaryEnd = maximum != null ? new Date(maximum).toISOString() : null;
    }

    const base = {
      id: node.id,
      title: node.title,
      wbsCode: node.wbsCode,
      parentTaskId: node.parentTaskId,
      depth: node.depth,
      isSummary: node.isSummary,
      isMilestone: dates?.isMilestone ?? false,
      status: node.status,
      progress: node.progress,
      startDate,
      dueDate,
      summaryStart,
      summaryEnd,
    };
    return critical === undefined ? base : { ...base, critical };
  });

  const dependencyRows = await prismaTaskDeps(projectId);
  const links: GanttLink[] = dependencyRows.map((dependency) => ({
    id: dependency.id,
    source: dependency.dependsOnId,
    target: dependency.taskId,
    type: dependency.type,
    lag: dependency.lag,
    lagUnit: dependency.lagUnit,
  }));

  return {
    tasks,
    links,
    criticalChain: schedule.criticalChain,
    scheduleVersion: schedule.scheduleVersion,
    project: {
      start: schedule.start != null ? new Date(schedule.start).toISOString() : null,
      end: schedule.end != null ? new Date(schedule.end).toISOString() : null,
    },
  };
}

function collectDescendants(
  id: string,
  childrenMap: Map<string | null, string[]>,
): string[] {
  const result: string[] = [];
  const stack = [...(childrenMap.get(id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    result.push(current);
    stack.push(...(childrenMap.get(current) ?? []));
  }
  return result;
}

async function prismaDateRows(projectId: string) {
  const rows = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, startDate: true, dueDate: true, isMilestone: true },
  });
  const result = new Map<string, {
    startDate: Date | null;
    dueDate: Date | null;
    isMilestone: boolean;
  }>();
  for (const row of rows) {
    result.set(row.id, {
      startDate: row.startDate,
      dueDate: row.dueDate,
      isMilestone: row.isMilestone,
    });
  }
  return result;
}

async function prismaTaskDeps(projectId: string) {
  const taskIds = (
    await prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true },
    })
  ).map((task) => task.id);

  return prisma.taskDependency.findMany({
    where: {
      deletedAt: null,
      taskId: { in: taskIds },
      dependsOnId: { in: taskIds },
    },
    select: {
      id: true,
      taskId: true,
      dependsOnId: true,
      type: true,
      lag: true,
      lagUnit: true,
    },
  });
}
