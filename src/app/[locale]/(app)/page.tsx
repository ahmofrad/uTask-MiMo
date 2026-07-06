import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export default async function AppHomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [assignedTasks, overdueTasks, completedThisWeek, unreadNotifications, recentTasks, allTasks, projects] =
    await Promise.all([
      prisma.task.count({
        where: { assigneeId: userId, deletedAt: null, parentTaskId: null, status: { not: "done" } },
      }),
      prisma.task.count({
        where: {
          assigneeId: userId,
          deletedAt: null, parentTaskId: null,
          dueDate: { lt: new Date() },
          status: { not: "done" },
        },
      }),
      prisma.task.count({
        where: {
          assigneeId: userId,
          status: "done",
          updatedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
      prisma.task.findMany({
        where: { deletedAt: null, parentTaskId: null, assigneeId: userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        where: { deletedAt: null, parentTaskId: null },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          startDate: true,
          parentTaskId: true,
          assignee: { select: { displayName: true, avatarUrl: true } },
          project: { select: { name: true } },
          tags: { include: { tag: { select: { id: true, name: true } } } },
          subtasks: {
            where: { deletedAt: null },
            select: { id: true, status: true },
          },
          _count: { select: { subtasks: { where: { deletedAt: null } } } },
        },
      }),
      prisma.project.findMany({
        where: {
          members: { some: { userId } },
          archivedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          _count: { select: { tasks: { where: { deletedAt: null, parentTaskId: null } }, members: true } },
        },
      }),
    ]);

  const t = await getTranslations("reports");

  return (
    <div className="px-6 py-6">
      <DashboardPage
        userId={userId}
        stats={[
          { label: String(t("assignedTasks")), value: Number(assignedTasks), color: "accent" as const },
          { label: String(t("overdueTasks")), value: Number(overdueTasks), color: "danger" as const },
          { label: String(t("completedThisWeek")), value: Number(completedThisWeek), color: "success" as const },
          { label: String(t("unreadNotifications")), value: Number(unreadNotifications), color: "info" as const },
        ]}
        recentTasks={recentTasks.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          priority: r.priority,
          dueDate: r.dueDate?.toISOString() ?? null,
          projectName: r.project.name,
          updatedAt: r.updatedAt.toISOString(),
        }))}
        allTasks={allTasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
          assigneeId: t.assigneeId,
          startDate: t.startDate?.toISOString() ?? null,
          parentTaskId: t.parentTaskId,
          assignee: t.assignee,
          projectName: t.project.name,
          tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
          subtaskCount: t._count.subtasks,
          subtaskDone: t.subtasks.filter((st) => st.status === "done").length,
        }))}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          color: p.color,
          taskCount: p._count.tasks,
          memberCount: p._count.members,
        }))}
      />
    </div>
  );
}
