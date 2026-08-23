import { prisma } from "@/lib/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

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
  return {
    totalUsers, totalProjects, totalTasks, completedTasks, overdueTasks,
    tasksByProject: tasksByProject.map((r) => ({ projectId: r.projectId, count: r._count })),
  };
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
