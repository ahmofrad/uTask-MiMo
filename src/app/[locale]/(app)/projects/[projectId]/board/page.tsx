import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Board } from "@/components/task/board";
import { canReadProject } from "@/lib/rbac";

export default async function BoardPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!(await canReadProject(session.user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: projectId, deletedAt: null, parentTaskId: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
    orderBy: { orderIndex: "asc" },
  });

  return (
    <div className="px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">{project.name}</h1>
        <span className="text-sm text-fg-muted">Board view</span>
      </div>
      <Board
        initialTasks={tasks.map((t) => ({
          ...t,
          dueDate: t.dueDate?.toISOString() ?? null,
          assignees: t.assignees.map((a) => ({
            id: a.user.id,
            displayName: a.user.displayName,
            avatarUrl: a.user.avatarUrl,
          })),
        }))}
        projectId={projectId}
        currentUserId={session.user.id}
      />
    </div>
  );
}
