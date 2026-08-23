import { prisma } from "@/lib/db";
import { toPlainCustomFieldValue } from "@/lib/custom-fields/values";
import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { isTaskFinalizer } from "@/lib/tasks";
import { canReadTask } from "@/lib/rbac";
import { TaskDetailPage } from "@/components/task/task-detail-page";
import { getTaskActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export default async function TaskDetailRoute(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await canReadTask(session.user.id, id))) notFound();

  const task = await prisma.task.findUnique({
    where: { id: id },
    include: {
      project: { select: { id: true, name: true } },
      assignees: {
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      },
      assigneeGroup: { select: { id: true, name: true } },
      reporter: { select: { id: true, displayName: true, email: true } },
      createdBy: { select: { id: true, displayName: true } },
      parentTask: { select: { id: true, title: true } },
      subtasks: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assignees: {
            include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          },
        },
      },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true, watchers: true } },
    },
  });

  if (!task || task.deletedAt) notFound();

  const canApprove = await isTaskFinalizer(session.user.id, {
    projectId: task.projectId,
    approverId: task.approverId,
  });
  const approver = task.approverId
    ? await prisma.user.findUnique({
        where: { id: task.approverId },
        select: { displayName: true },
      })
    : null;

  const [
    customFields,
    customFieldValues,
    comments,
    watchers,
    attachments,
    activityResult,
    projectMembers,
  ] = await Promise.all([
    prisma.customField.findMany({
      where: { projectId: task.projectId, archivedAt: null },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.customFieldValue.findMany({
      where: { taskId: id },
    }),
    prisma.comment.findMany({
      where: { taskId: id, deletedAt: null, parentCommentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.watcher.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
    }),
    prisma.attachment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
    }),
    getTaskActivity(id, session.user.id, { limit: 10 }),
    prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    }),
  ]);

  const cfValuesMap: Record<string, unknown> = {};
  for (const cfv of customFieldValues) {
    const fieldKey = customFields.find((cf) => cf.id === cfv.customFieldId)?.key;
    if (fieldKey) {
      // Prisma returns valueNumber as a Decimal object, which Next.js rejects
      // across the Server → Client boundary — normalize it to a plain number.
      cfValuesMap[fieldKey] = toPlainCustomFieldValue(
        cfv.valueText ?? cfv.valueNumber ?? cfv.valueDate ?? cfv.valueBool ?? cfv.valueJson ?? null,
      );
    }
  }

  const customFieldSchema = customFields.map((cf) => {
    const config: Record<string, unknown> = {};
    if (cf.configJson) {
      const c = cf.configJson as Record<string, unknown>;
      if (c.options) config.options = c.options;
      if (c.maxLength) config.maxLength = Number(c.maxLength);
      if (c.min) config.min = Number(c.min);
      if (c.max) config.max = Number(c.max);
    }
    return {
      id: cf.id,
      key: cf.key,
      name: cf.name,
      type: cf.type as
        "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url",
      required: cf.required,
      config,
    };
  });

  return (
    <TaskDetailPage
      task={{
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status as "open" | "in_progress" | "pending_approval" | "done" | "cancelled",
        requiresApproval: task.requiresApproval,
        approverId: task.approverId,
        approvalNote: task.approvalNote,
        recurrenceRule: task.recurrenceRule,
        recurrenceParentId: task.recurrenceParentId,
        priority: task.priority as "low" | "med" | "high" | "urgent",
        startDate: task.startDate?.toISOString() ?? null,
        endDate: task.endDate?.toISOString() ?? null,
        dueDate: task.dueDate?.toISOString() ?? null,
        estimatedHours: task.estimatedHours?.toNumber() ?? null,
        spentHours: task.spentHours?.toNumber() ?? null,
        projectId: task.projectId,
        projectName: task.project.name,
        assignees: task.assignees.map((a) => ({
          id: a.user.id,
          displayName: a.user.displayName,
          avatarUrl: a.user.avatarUrl,
        })),
        assigneeGroup: task.assigneeGroup,
        reporter: task.reporter
          ? { id: task.reporter.id, displayName: task.reporter.displayName }
          : null,
        tags: task.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
        subtasks: task.subtasks.map((st) => ({
          id: st.id,
          title: st.title,
          status: st.status as "open" | "in_progress" | "done" | "cancelled",
          priority: st.priority as "low" | "med" | "high" | "urgent",
          assignees: st.assignees.map((a) => ({
            id: a.user.id,
            displayName: a.user.displayName,
            avatarUrl: a.user.avatarUrl,
          })),
        })),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }}
      customFieldSchema={customFieldSchema}
      customFieldValues={cfValuesMap}
      comments={comments.map((c) => ({
        id: c.id,
        body: c.bodyMarkdown,
        createdAt: c.createdAt.toISOString(),
        authorId: c.authorId,
        author: { displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
        replies: c.replies.map((r) => ({
          id: r.id,
          body: r.bodyMarkdown,
          createdAt: r.createdAt.toISOString(),
          author: { displayName: r.author.displayName, avatarUrl: r.author.avatarUrl },
        })),
      }))}
      watchers={watchers.map((w) => ({
        id: w.user.id,
        displayName: w.user.displayName,
        avatarUrl: w.user.avatarUrl,
        addedAt: w.addedAt.toISOString(),
      }))}
      attachments={attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      }))}
      auditEvents={activityResult.items}
      auditHasMore={activityResult.hasMore}
      auditNextCursor={activityResult.nextCursor}
      projectMembers={projectMembers.map((pm) => ({
        id: pm.user.id,
        displayName: pm.user.displayName,
        avatarUrl: pm.user.avatarUrl,
      }))}
      currentUserId={session.user.id}
      canApprove={canApprove}
      approverName={approver?.displayName ?? null}
    />
  );
}
