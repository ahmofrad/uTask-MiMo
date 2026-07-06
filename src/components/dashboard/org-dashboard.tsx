import { prisma } from "@/lib/db";

export async function OrgDashboard() {
  const [userCount, taskCount, projectCount, completedTasks] = await Promise.all([
    prisma.user.count({ where: { status: "active" } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.project.count(),
    prisma.task.count({ where: { deletedAt: null, status: "done" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-primary p-5 bg-info-bg text-info">
          <div className="text-3xl font-bold">{userCount}</div>
          <div className="text-sm opacity-80 mt-1">Active Users</div>
        </div>
        <div className="rounded-xl border border-border-primary p-5 bg-success-bg text-success">
          <div className="text-3xl font-bold">{taskCount}</div>
          <div className="text-sm opacity-80 mt-1">Total Tasks</div>
        </div>
        <div className="rounded-xl border border-border-primary p-5 bg-accent-bg text-accent">
          <div className="text-3xl font-bold">{projectCount}</div>
          <div className="text-sm opacity-80 mt-1">Projects</div>
        </div>
        <div className="rounded-xl border border-border-primary p-5 bg-warning-bg text-warning">
          <div className="text-3xl font-bold">{completedTasks}</div>
          <div className="text-sm opacity-80 mt-1">Completed</div>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">Task Completion Rate</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${taskCount > 0 ? (completedTasks / taskCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium text-fg-primary">
            {taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
