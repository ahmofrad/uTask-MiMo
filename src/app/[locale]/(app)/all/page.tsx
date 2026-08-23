import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { getUserReadableProjectIds } from "@/lib/projects";

export default async function AllTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("nav");
  const readableProjectIds = await getUserReadableProjectIds(session.user.id);

  const tasks = await prisma.task.findMany({
    where: {
      ...(readableProjectIds === null ? {} : { projectId: { in: readableProjectIds } }),
      deletedAt: null,
      parentTaskId: null,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { name: true } },
      assignees: { include: { user: { select: { displayName: true } } } },
    },
  });

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">{t("admin")}</h1>

      <div className="space-y-2">
        {tasks.map((task) => (
          <a
            key={task.id}
            href={`/tasks/${task.id}`}
            className="flex items-center gap-4 p-3 rounded-lg border border-border-primary bg-bg-surface hover:border-border-strong transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              task.status === "done" ? "bg-success" :
              task.status === "in_progress" ? "bg-warning" :
              task.status === "cancelled" ? "bg-fg-subtle" :
              "bg-info"
            }`} />
            <span className="flex-1 text-sm text-fg-primary truncate">{task.title}</span>
            <span className="text-xs text-fg-muted">{task.project?.name}</span>
            <span className="text-xs text-fg-muted">
              {task.assignees.map((a) => a.user.displayName).join(", ") || "Unassigned"}
            </span>
          </a>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">No tasks found</p>
        )}
      </div>
    </div>
  );
}
