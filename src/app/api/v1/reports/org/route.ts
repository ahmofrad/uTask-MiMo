import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  if (!(await can(session.user.id, "org:reports"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const totalUsers = await prisma.user.count({ where: { status: "active" } });
  const totalProjects = await prisma.project.count({ where: { archivedAt: null } });
  const totalTasks = await prisma.task.count({ where: { deletedAt: null } });
  const completedTasks = await prisma.task.count({ where: { status: "done" } });
  const overdueTasks = await prisma.task.count({
    where: { deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });

  const tasksByProject = await prisma.task.groupBy({
    by: ["projectId"],
    where: { deletedAt: null },
    _count: true,
  });

  return NextResponse.json({
    data: {
      totalUsers,
      totalProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
      tasksByProject: tasksByProject.map((r) => ({ projectId: r.projectId, count: r._count })),
    },
  });
}
