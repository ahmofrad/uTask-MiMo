import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

/**
 * Member-throughput rows are derived from the full org-wide taskAssignee
 * table, which is O(assignments) per render. Cache the result for 60 s so
 * frequent dashboard loads don't rescan the whole table. Invalidation is
 * best-effort and bounded by the TTL; reports are aggregate snapshots anyway.
 */
const MEMBER_THROUGHPUT_TTL_SECONDS = 60;
const MEMBER_THROUGHPUT_KEY = (orgId: string) => `report:member-throughput:v1:${orgId}`;

type MemberThroughputRow = {
  userId: string;
  displayName: string;
  completed30: number;
  onTimeRate: number | null;
  workload: number;
};

export async function getOrgReport(organizationId = DEFAULT_ORGANIZATION_ID) {
  return liveOrgReport(organizationId);
}

export async function getProjectReport(projectId: string, organizationId = DEFAULT_ORGANIZATION_ID) {
  return liveProjectReport(projectId, organizationId);
}

export async function getMyDashboard(userId: string, organizationId = DEFAULT_ORGANIZATION_ID) {
  return liveMyDashboard(userId, organizationId);
}

async function liveOrgReport(organizationId: string) {
  const totalUsers = await prisma.user.count({ where: { status: "active", organizationMemberships: { some: { organizationId } } } });
  const totalProjects = await prisma.project.count({ where: { organizationId, archivedAt: null } });
  const totalTasks = await prisma.task.count({ where: { deletedAt: null, project: { organizationId } } });
  const completedTasks = await prisma.task.count({ where: { status: "done", deletedAt: null, project: { organizationId } } });
  const overdueTasks = await prisma.task.count({
    where: { deletedAt: null, project: { organizationId }, dueDate: { lt: new Date() }, status: { not: "done" } },
  });
  const tasksByProject = await prisma.task.groupBy({
    by: ["projectId"],
    where: { deletedAt: null, project: { organizationId } },
    _count: true,
  });
  const memberThroughput = await cachedMemberThroughput(organizationId);
  return {
    totalUsers, totalProjects, totalTasks, completedTasks, overdueTasks,
    tasksByProject: tasksByProject.map((r) => ({ projectId: r.projectId, count: r._count })),
    memberThroughput,
  };
}

/**
 * Per-member output metrics (M6 gap): tasks completed in the last 30 days,
 * on-time completion rate, and current open workload. Reuses the task/assignee
 * rows so no new report tables are needed.
 */
async function cachedMemberThroughput(organizationId: string): Promise<MemberThroughputRow[]> {
  const key = MEMBER_THROUGHPUT_KEY(organizationId);
  try {
    const redis = await getRedis();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as MemberThroughputRow[];
  } catch {
    // Redis unavailable → compute live; the query is correct, just heavier.
  }

  const rows = await computeMemberThroughput(organizationId);

  try {
    const redis = await getRedis();
    await redis.set(key, JSON.stringify(rows), "EX", MEMBER_THROUGHPUT_TTL_SECONDS);
  } catch {
    // Cache write failures must never fail the report.
  }
  return rows;
}

async function computeMemberThroughput(organizationId: string): Promise<MemberThroughputRow[]> {
  const since30 = new Date(Date.now() - 30 * 86400000);

  const rows = await prisma.taskAssignee.findMany({
    where: { task: { deletedAt: null, project: { organizationId } } },
    select: {
      userId: true,
      task: {
        select: { status: true, dueDate: true, completedAt: true },
      },
    },
  });

  const byUser = new Map<string, {
    completed30: number;
    onTime: number;
    completedTotal: number;
    workload: number;
  }>();

  for (const row of rows) {
    const bucket = byUser.get(row.userId) ?? { completed30: 0, onTime: 0, completedTotal: 0, workload: 0 };
    if (row.task.status === "done" && row.task.completedAt) {
      bucket.completedTotal++;
      if (row.task.completedAt >= since30) bucket.completed30++;
      const due = row.task.dueDate;
      if (!due || row.task.completedAt <= due) bucket.onTime++;
    } else if (row.task.status === "open" || row.task.status === "in_progress") {
      bucket.workload++;
    }
    byUser.set(row.userId, bucket);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(byUser.keys()) }, status: "active" },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));

  return Array.from(byUser.entries())
    .map(([userId, m]) => ({
      userId,
      displayName: nameById.get(userId) ?? "Unknown",
      completed30: m.completed30,
      onTimeRate: m.completedTotal > 0 ? Math.round((m.onTime / m.completedTotal) * 100) : null,
      workload: m.workload,
    }))
    .sort((a, b) => b.completed30 - a.completed30);
}

async function liveProjectReport(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
  if (!project) return { totalTasks: 0, byStatus: {}, overdue: 0, completedThisMonth: 0 };

  const totalTasks = await prisma.task.count({ where: { projectId, deletedAt: null } });
  const byStatus = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId, deletedAt: null },
    _count: true,
  });
  const overdue = await prisma.task.count({
    where: { projectId, deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });
  const completedThisMonth = await prisma.task.count({
    where: { projectId, status: "done", deletedAt: null, updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
  });
  return {
    totalTasks,
    byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
    overdue,
    completedThisMonth,
  };
}

async function liveMyDashboard(userId: string, organizationId: string) {
  const projectScope = { project: { organizationId } };
  const assignedTasks = await prisma.task.count({
    where: { ...projectScope, assignees: { some: { userId } }, deletedAt: null, status: { not: "done" } },
  });
  const overdueTasks = await prisma.task.count({
    where: { ...projectScope, assignees: { some: { userId } }, deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });
  const completedThisWeek = await prisma.task.count({
    where: { ...projectScope, assignees: { some: { userId } }, status: "done", deletedAt: null, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });
  const unreadNotifications = await prisma.notification.count({ where: { userId, readAt: null } });
  return { assignedTasks, overdueTasks, completedThisWeek, unreadNotifications };
}
