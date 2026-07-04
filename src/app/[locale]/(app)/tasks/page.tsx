import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/task/task-list";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tasks = await prisma.task.findMany({
    where: { deletedAt: null },
    orderBy: { orderIndex: "asc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      projectId: true,
      assigneeId: true,
      dueDate: true,
      orderIndex: true,
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">Tasks</h1>
      <TaskList
        initialTasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          projectId: t.projectId,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate?.toISOString() ?? null,
          orderIndex: Number(t.orderIndex ?? 0),
        }))}
      />
    </div>
  );
}
