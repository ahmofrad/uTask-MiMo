import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { getWbsForProject } from "@/lib/tasks";
import { computeSchedule } from "@/lib/scheduling/cpm";
import type { GanttRow, GanttLink, GanttReport } from "@/lib/gantt-types";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted =
    (await canProject(userId, "task:edit_any", params.projectId)) ||
    (await canProject(userId, "task:edit_own", params.projectId)) ||
    (await canProject(userId, "comment:create", params.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const url = new URL(request.url);
  const include = new Set((url.searchParams.get("include") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const withCritical = include.has("criticalPath");

  const tree = await getWbsForProject(params.projectId);
  const dateRows = await prismaDateRows(params.projectId);
  const schedule = await computeSchedule(params.projectId);

  const childrenMap = new Map<string | null, string[]>();
  for (const n of tree) {
    const arr = childrenMap.get(n.parentTaskId) ?? [];
    arr.push(n.id);
    childrenMap.set(n.parentTaskId, arr);
  }

  const tasks: GanttRow[] = tree.map((n) => {
    const d = dateRows.get(n.id);
    const start = d?.startDate?.toISOString() ?? null;
    const due = d?.dueDate?.toISOString() ?? null;
    const isMilestone = d?.isMilestone ?? false;

    const sched = schedule.schedule[n.id];
    const critical = withCritical && sched && !sched.unscheduled ? sched.critical : undefined;

    let summaryStart: string | null = null;
    let summaryEnd: string | null = null;
    if (n.isSummary) {
      const desc = collectDescendants(n.id, childrenMap);
      let min: number | null = null;
      let max: number | null = null;
      for (const id of desc) {
        const dd = dateRows.get(id);
        if (dd?.startDate) min = min == null ? dd.startDate.getTime() : Math.min(min, dd.startDate.getTime());
        if (dd?.dueDate) max = max == null ? dd.dueDate.getTime() : Math.max(max, dd.dueDate.getTime());
      }
      if (min == null && sched) min = schedule.start;
      if (max == null && sched) max = schedule.end;
      summaryStart = min != null ? new Date(min).toISOString() : null;
      summaryEnd = max != null ? new Date(max).toISOString() : null;
    }

    const base = {
      id: n.id,
      title: n.title,
      wbsCode: n.wbsCode,
      parentTaskId: n.parentTaskId,
      depth: n.depth,
      isSummary: n.isSummary,
      isMilestone,
      status: n.status,
      progress: n.progress,
      startDate: start,
      dueDate: due,
      summaryStart,
      summaryEnd,
    };
    return critical === undefined ? base : { ...base, critical };
  });

  const depRows = await prismaTaskDeps(params.projectId);
  const links: GanttLink[] = depRows.map((e) => ({
    id: e.id,
    source: e.dependsOnId,
    target: e.taskId,
    type: e.type,
    lag: e.lag,
    lagUnit: e.lagUnit,
  }));

  const report: GanttReport = {
    tasks,
    links,
    criticalChain: schedule.criticalChain,
    scheduleVersion: schedule.scheduleVersion,
    project: {
      start: schedule.start != null ? new Date(schedule.start).toISOString() : null,
      end: schedule.end != null ? new Date(schedule.end).toISOString() : null,
    },
  };

  return NextResponse.json({ data: report });
}

function collectDescendants(id: string, childrenMap: Map<string | null, string[]>): string[] {
  const out: string[] = [];
  const stack = [...(childrenMap.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    stack.push(...(childrenMap.get(cur) ?? []));
  }
  return out;
}

async function prismaDateRows(projectId: string) {
  const rows = await (
    await import("@/lib/db")
  ).prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, startDate: true, dueDate: true, isMilestone: true },
  });
  const map = new Map<string, { startDate: Date | null; dueDate: Date | null; isMilestone: boolean }>();
  for (const r of rows) map.set(r.id, { startDate: r.startDate, dueDate: r.dueDate, isMilestone: r.isMilestone });
  return map;
}

async function prismaTaskDeps(projectId: string) {
  const { prisma } = await import("@/lib/db");
  const taskIds = (
    await prisma.task.findMany({ where: { projectId, deletedAt: null }, select: { id: true } })
  ).map((t) => t.id);
  return prisma.taskDependency.findMany({
    where: { deletedAt: null, taskId: { in: taskIds }, dependsOnId: { in: taskIds } },
    select: { id: true, taskId: true, dependsOnId: true, type: true, lag: true, lagUnit: true },
  });
}