import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;

  const assignedTasks = await prisma.task.count({
    where: { assigneeId: userId, deletedAt: null, status: { not: "done" } },
  });

  const overdueTasks = await prisma.task.count({
    where: { assigneeId: userId, deletedAt: null, dueDate: { lt: new Date() }, status: { not: "done" } },
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

  return NextResponse.json({
    data: {
      assignedTasks,
      overdueTasks,
      completedThisWeek,
      unreadNotifications,
    },
  });
}
