import { prisma } from "@/lib/db";

export async function getOrgReport() {
  const totalUsers = await prisma.user.count({ where: { status: "active" } });
  const totalProjects = await prisma.project.count({
    where: { archivedAt: null },
  });
  const totalTasks = await prisma.task.count({ where: { deletedAt: null } });
  const completedTasks = await prisma.task.count({
    where: { status: "done" },
  });
  const overdueTasks = await prisma.task.count({
    where: {
      deletedAt: null,
      dueDate: { lt: new Date() },
      status: { not: "done" },
    },
  });

  const tasksByProject = await prisma.task.groupBy({
    by: ["projectId"],
    where: { deletedAt: null },
    _count: true,
  });

  return {
    totalUsers,
    totalProjects,
    totalTasks,
    completedTasks,
    overdueTasks,
    tasksByProject: tasksByProject.map((r) => ({
      projectId: r.projectId,
      count: r._count,
    })),
  };
}

export async function getProjectReport(projectId: string) {
  const totalTasks = await prisma.task.count({
    where: { projectId, deletedAt: null },
  });

  const byStatus = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId, deletedAt: null },
    _count: true,
  });

  const overdue = await prisma.task.count({
    where: {
      projectId,
      deletedAt: null,
      dueDate: { lt: new Date() },
      status: { not: "done" },
    },
  });

  const completedThisMonth = await prisma.task.count({
    where: {
      projectId,
      status: "done",
      updatedAt: { gte: new Date(Date.now() - 30 * 86400000) },
    },
  });

  return {
    totalTasks,
    byStatus: byStatus.reduce(
      (acc, s) => ({ ...acc, [s.status]: s._count }),
      {} as Record<string, number>,
    ),
    overdue,
    completedThisMonth,
  };
}

export async function getMyDashboard(userId: string) {
  const assignedTasks = await prisma.task.count({
    where: { assigneeId: userId, deletedAt: null, status: { not: "done" } },
  });

  const overdueTasks = await prisma.task.count({
    where: {
      assigneeId: userId,
      deletedAt: null,
      dueDate: { lt: new Date() },
      status: { not: "done" },
    },
  });

  const completedThisWeek = await prisma.task.count({
    where: {
      assigneeId: userId,
      status: "done",
      updatedAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
  });

  const unreadNotifications = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  return {
    assignedTasks,
    overdueTasks,
    completedThisWeek,
    unreadNotifications,
  };
}
