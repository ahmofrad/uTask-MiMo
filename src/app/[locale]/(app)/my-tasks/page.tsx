import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tasks = await prisma.task.findMany({
    where: { assigneeId: session.user.id, deletedAt: null, parentTaskId: null },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { name: true } },
    },
  });

  const groups = {
    overdue: tasks.filter((t) => t.dueDate && t.dueDate < new Date() && t.status !== "done"),
    today: tasks.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const today = new Date();
      return t.dueDate.toDateString() === today.toDateString();
    }),
    upcoming: tasks.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const today = new Date();
      return t.dueDate > today;
    }),
    noDate: tasks.filter((t) => !t.dueDate && t.status !== "done"),
  };

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">My Tasks</h1>

      {[
        { label: "Overdue", tasks: groups.overdue, color: "text-destructive" },
        { label: "Today", tasks: groups.today, color: "text-warning" },
        { label: "Upcoming", tasks: groups.upcoming, color: "text-fg-primary" },
        { label: "No due date", tasks: groups.noDate, color: "text-fg-muted" },
      ].filter((g) => g.tasks.length > 0).map((group) => (
        <div key={group.label} className="mb-6">
          <h2 className={`text-sm font-semibold ${group.color} mb-3`}>
            {group.label.toUpperCase()} ({group.tasks.length})
          </h2>
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <a
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-4 p-3 rounded-lg border border-border-primary bg-bg-surface hover:border-border-strong transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  task.status === "done" ? "bg-success" :
                  task.status === "in_progress" ? "bg-warning" :
                  "bg-info"
                }`} />
                <span className="flex-1 text-sm text-fg-primary truncate">{task.title}</span>
                <span className="text-xs text-fg-muted">{task.project?.name}</span>
              </a>
            ))}
          </div>
        </div>
      ))}

      {tasks.length === 0 && (
        <p className="text-sm text-fg-muted text-center py-8">No tasks assigned to you</p>
      )}
    </div>
  );
}
