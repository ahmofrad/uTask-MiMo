import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ProjectDetailPage } from "@/components/project/project-detail-page";

export default async function ProjectDetail({
  params: { projectId },
}: {
  params: { projectId: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  // Check access: user must be a member or global admin/owner
  const isAdmin = await can(userId, "user:manage");
  let membership: { projectRole: string } | null = null;
  if (!isAdmin) {
    membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { projectRole: true },
    });
    if (!membership) notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId, archivedAt: null },
    include: {
      _count: { select: { tasks: true, members: true } },
      owner: { select: { id: true, displayName: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
        take: 10,
      },
    },
  });

  if (!project) notFound();

  const canManage =
    (await can(userId, "project:update")) ||
    project.owner.id === userId ||
    membership?.projectRole === "lead";

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      startDate: true,
      parentTaskId: true,
      orderIndex: true,
      assignee: { select: { displayName: true, avatarUrl: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      subtasks: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
      _count: { select: { subtasks: { where: { deletedAt: null } } } },
    },
  });

  return (
    <div className="px-6 py-6">
       <ProjectDetailPage
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
          status: project.status,
          visibility: project.visibility,
          ownerName: project.owner.displayName,
          ownerId: project.owner.id,
          isOwner: project.owner.id === userId,
          canManage: canManage,
          memberCount: project._count.members,
          taskCount: project._count.tasks,
          members: project.members.map((m) => ({
            id: m.user.id,
            displayName: m.user.displayName,
            avatarUrl: m.user.avatarUrl,
          })),
          projectRole: project.members.find((m) => m.user.id === userId)?.projectRole ?? null,
        }}
        initialTasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId: project.id,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate?.toISOString() ?? null,
          startDate: t.startDate?.toISOString() ?? null,
          parentTaskId: t.parentTaskId,
          orderIndex: Number(t.orderIndex ?? 0),
          assignee: t.assignee,
          tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
          subtaskCount: t._count.subtasks,
          subtaskDone: t.subtasks.filter((st) => st.status === "done").length,
        }))}
      />
    </div>
  );
}
