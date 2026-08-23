import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

export type NotificationType =
  | "assigned"
  | "mentioned"
  | "due_soon"
  | "commented"
  | "status_changed"
  | "unblocked"
  | "department_link_request"
  | "group_role_granted"
  | "group_role_revoked";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  taskId?: string;
  payload?: Record<string, unknown>;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type as never,
      taskId: params.taskId ?? null,
      payloadJson: (params.payload ?? {}) as never,
    },
  });
  return notification;
}

/**
 * Create a notification without ever throwing — a notification failure must not
 * break the primary action (comment, assignment, status change, etc.).
 */
export async function notify(params: {
  userId: string;
  type: NotificationType;
  taskId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch (err) {
    logger.warn({ err, userId: params.userId, type: params.type }, "Failed to create notification");
  }
}

/**
 * Notify every current member of a group that its role on a project was
 * granted or revoked. Live membership: the fan-out reads memberships at emit
 * time, so only currently-affected users are notified. Empty groups are a
 * no-op; notification failures never propagate.
 */
export async function notifyGroupRoleChange(params: {
  groupId: string;
  groupName: string;
  projectId: string;
  projectName: string;
  role: string;
  action: "granted" | "revoked";
}): Promise<void> {
  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: params.groupId },
    select: { userId: true },
  });
  const userIds = Array.from(new Set(memberships.map((membership) => membership.userId)));
  if (userIds.length === 0) return;

  const type: NotificationType = params.action === "granted" ? "group_role_granted" : "group_role_revoked";
  await Promise.all(userIds.map((userId) => notify({
    userId,
    type,
    payload: {
      groupId: params.groupId,
      groupName: params.groupName,
      projectId: params.projectId,
      projectName: params.projectName,
      role: params.role,
    },
  })));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markAsRead(notificationId: string, userId?: string) {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      ...(userId ? { userId } : {}),
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
