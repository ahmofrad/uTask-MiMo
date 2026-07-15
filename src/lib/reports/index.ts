import { prisma } from "@/lib/db";

export async function getOrgReport() {
  try {
    const stats = await prisma.$queryRawUnsafe<Array<{
      total_users: bigint;
      total_projects: bigint;
      total_tasks: bigint;
      completed_tasks: bigint;
      overdue_tasks: bigint;
    }>>("SELECT * FROM mv_org_stats");
    const row = stats[0];
    if (row) {
      return {
        totalUsers: Number(row.total_users),
        totalProjects: Number(row.total_projects),
        totalTasks: Number(row.total_tasks),
        completedTasks: Number(row.completed_tasks),
        overdueTasks: Number(row.overdue_tasks),
        tasksByProject: await getTasksByProjectLive(),
      };
    }
  } catch {
    // Materialized view not available — fall through to live query
  }

  return liveOrgReport();
}

export async function getProjectReport(projectId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      total_tasks: bigint;
      open_tasks: bigint;
      in_progress_tasks: bigint;
      done_tasks: bigint;
      cancelled_tasks: bigint;
      overdue_tasks: bigint;
      completed_this_month: bigint;
    }>>(
      `SELECT total_tasks, open_tasks, in_progress_tasks, done_tasks, cancelled_tasks, overdue_tasks, completed_this_month
       FROM mv_project_task_stats WHERE project_id = $1::uuid`,
      projectId,
    );
    const row = rows[0];
    if (row) {
      return {
        totalTasks: Number(row.total_tasks),
        byStatus: {
          open: Number(row.open_tasks),
          in_progress: Number(row.in_progress_tasks),
          done: Number(row.done_tasks),
          cancelled: Number(row.cancelled_tasks),
        },
        overdue: Number(row.overdue_tasks),
        completedThisMonth: Number(row.completed_this_month),
      };
    }
  } catch {
    // Materialized view not available — fall through
  }

  return liveProjectReport(projectId);
}

export async function getMyDashboard(userId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      assigned_active: bigint;
      assigned_overdue: bigint;
      completed_this_week: bigint;
    }>>(
      `SELECT assigned_active, assigned_overdue, completed_this_week
       FROM mv_user_task_stats WHERE user_id = $1::uuid`,
      userId,
    );
    const row = rows[0];
    if (row) {
      const unreadNotifications = await prisma.notification.count({
        where: { userId, readAt: null },
      });
      return {
        assignedTasks: Number(row.assigned_active),
        overdueTasks: Number(row.assigned_overdue),
        completedThisWeek: Number(row.completed_this_week),
        unreadNotifications,
      };
    }
  } catch {
    // Materialized view not available — fall through
  }

  return liveMyDashboard(userId);
}

async function liveOrgReport() {
  const totalUsers = await prisma.user.count({ where: { status: "active" } });
  const totalProjects = await prisma.project.count({ where: { archivedAt: null } });
  const totalTasks = await prisma.task.count({ where: { deletedAt: null } });
  const completedTasks = await prisma.task.count({ where: { status: "done", deletedAt: null } });
  const overdueTasks = await prisma.task.count({
    where: { deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });
  const tasksByProject = await prisma.task.groupBy({
    by: ["projectId"],
    where: { deletedAt: null },
    _count: true,
  });
  return {
    totalUsers, totalProjects, totalTasks, completedTasks, overdueTasks,
    tasksByProject: tasksByProject.map((r) => ({ projectId: r.projectId, count: r._count })),
  };
}

async function liveProjectReport(projectId: string) {
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

async function liveMyDashboard(userId: string) {
  const assignedTasks = await prisma.task.count({
    where: { assignees: { some: { userId } }, deletedAt: null, status: { not: "done" } },
  });
  const overdueTasks = await prisma.task.count({
    where: { assignees: { some: { userId } }, deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });
  const completedThisWeek = await prisma.task.count({
    where: { assignees: { some: { userId } }, status: "done", deletedAt: null, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });
  const unreadNotifications = await prisma.notification.count({ where: { userId, readAt: null } });
  return { assignedTasks, overdueTasks, completedThisWeek, unreadNotifications };
}

async function getTasksByProjectLive() {
  const tasksByProject = await prisma.task.groupBy({
    by: ["projectId"],
    where: { deletedAt: null },
    _count: true,
  });
  return tasksByProject.map((r) => ({ projectId: r.projectId, count: r._count }));
}
