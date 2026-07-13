import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Board } from "@/components/task/board";

export default async function BoardPage({ params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId, deletedAt: null, parentTaskId: null },
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
        projectId={params.projectId}
      />
    </div>
  );
}
