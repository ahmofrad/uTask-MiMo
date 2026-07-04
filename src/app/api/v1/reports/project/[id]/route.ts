import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const totalTasks = await prisma.task.count({
    where: { projectId: params.id, deletedAt: null },
  });

  const byStatus = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId: params.id, deletedAt: null },
    _count: true,
  });

  const overdue = await prisma.task.count({
    where: { projectId: params.id, deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
  });

  const completedThisMonth = await prisma.task.count({
    where: { projectId: params.id, status: "done", updatedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
  });

  return NextResponse.json({
    data: {
      totalTasks,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
      overdue,
      completedThisMonth,
    },
  });
}
