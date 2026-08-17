import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { getProjectDependencyStatusMap } from "@/lib/tasks/dependency-status-queries";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export default async function AppHomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [assignedTasks, overdueTasks, completedThisWeek, unreadNotifications, allTasks] =
    await Promise.all([
      prisma.task.count({
        where: { assignees: { some: { userId } }, deletedAt: null, parentTaskId: null, status: { not: "done" } },
      }),
      prisma.task.count({
        where: {
          assignees: { some: { userId } },
          deletedAt: null, parentTaskId: null,
          dueDate: { lt: new Date() },
          status: { not: "done" },
        },
      }),
      prisma.task.count({
        where: {
          assignees: { some: { userId } },
          status: "done",
          updatedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
      prisma.task.findMany({
        where: { deletedAt: null, parentTaskId: null },
        orderBy: { dueDate: "asc" },
        take: 100,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          progress: true,
          parentTaskId: true,
          assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          project: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { id: true, name: true } } } },
          subtasks: {
            where: { deletedAt: null },
            select: { id: true, status: true },
          },
          _count: { select: { subtasks: { where: { deletedAt: null } } } },
        },
      }),
    ]);

  const projectIds = Array.from(new Set(allTasks.map((task) => task.project.id)));
  const dependencyStatus = await getProjectDependencyStatusMap(projectIds);

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
        allTasks={allTasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
          assignees: t.assignees.map((a) => ({
            id: a.user.id,
            displayName: a.user.displayName,
            avatarUrl: a.user.avatarUrl,
          })),
          startDate: t.startDate?.toISOString() ?? null,
          parentTaskId: t.parentTaskId,
          progress: t.progress ?? null,
          projectId: t.project.id,
          projectName: t.project.name,
          tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
          subtaskCount: t._count.subtasks,
          subtaskDone: t.subtasks.filter((st) => st.status === "done").length,
          blockedBy: dependencyStatus.get(t.id)?.blockedBy ?? [],
        }))}
      />
    </div>
  );
}
