import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, canProject, canReadProject } from "@/lib/rbac";
import { ProjectDetailPage } from "@/components/project/project-detail-page";

export default async function ProjectDetail(props: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  // Read access includes explicit membership and an active manager's department scope.
  const isAdmin = await can(userId, "user:manage");
  if (!(await canReadProject(userId, projectId))) notFound();

  let membership: { projectRole: string } | null = null;
  if (!isAdmin) {
    membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { projectRole: true },
    });
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

  const canManage = await canProject(userId, "project:update", projectId)
    || project.owner.id === userId
    || membership?.projectRole === "lead";

  const canAssignRoles = await canProject(userId, "project_role:assign", projectId);

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
      dueDate: true,
      startDate: true,
      progress: true,
      parentTaskId: true,
      orderIndex: true,
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
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
          canAssignRoles: canAssignRoles,
        }}
        initialTasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId: project.id,
          assignees: t.assignees.map((a) => ({
            id: a.user.id,
            displayName: a.user.displayName,
            avatarUrl: a.user.avatarUrl,
          })),
          dueDate: t.dueDate?.toISOString() ?? null,
          startDate: t.startDate?.toISOString() ?? null,
          parentTaskId: t.parentTaskId,
          progress: t.progress ?? null,
          orderIndex: Number(t.orderIndex ?? 0),
          tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
          subtaskCount: t._count.subtasks,
          subtaskDone: t.subtasks.filter((st) => st.status === "done").length,
        }))}
      />
    </div>
  );
}
