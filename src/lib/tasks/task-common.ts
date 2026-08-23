import { prisma } from "@/lib/db";

/**
 * Shared helpers used by the task mutation modules (create/update/delete/
 * move/reorder). Kept here so each mutation module stays focused.
 */

/** Fans out a group assignment to the group's current members. */
export async function resolveGroupAssigneeIds(groupId: string): Promise<string[]> {
  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: groupId },
    select: { userId: true },
  });
  return memberships.map((membership) => membership.userId);
}

export function clampProgress(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function notifyNewAssignees(taskId: string, title: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { ensureWatcher } = await import("@/lib/watchers");
  const { notify } = await import("@/lib/notifications");
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  for (const userId of userIds) {
    await ensureWatcher(taskId, userId);
    await notify({
      userId,
      type: "assigned",
      taskId,
      payload: { taskTitle: title },
    });

    try {
      const { notifyAssigned } = await import("@/lib/mail/send");
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await notifyAssigned(user.email, title, `${baseUrl}/tasks/${taskId}`);
      }
    } catch (err) {
      const { logger } = await import("@/lib/logging");
      logger.warn({ err, taskId, userId }, "Failed to send assignment email");
    }
  }
}

/**
 * Auto-adds users as project members (default "contributor" role) when they
 * are assigned to a task in the project but aren't yet members.
 *
 * Idempotent: existing memberships (including disabled ones) are left alone;
 * only users who have never been a member of the project get a new row.
 */
export async function ensureProjectMembers(projectId: string, assigneeIds: string[], adderId?: string) {
  if (assigneeIds.length === 0) return;
  const existingIds = new Set(
    (
      await prisma.projectMember.findMany({
        where: { projectId, userId: { in: assigneeIds } },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  const newIds = assigneeIds.filter((uid) => !existingIds.has(uid));
  if (newIds.length === 0) return;

  await prisma.projectMember.createMany({
    data: newIds.map((userId) => ({
      projectId,
      userId,
      projectRole: "contributor",
      addedBy: adderId ?? userId,
    })),
    skipDuplicates: true,
  });
}