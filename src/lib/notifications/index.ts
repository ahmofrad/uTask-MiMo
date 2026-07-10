import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";

export async function createNotification(params: {
  userId: string;
  type: "assigned" | "mentioned" | "due_soon" | "commented" | "status_changed";
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
  type: "assigned" | "mentioned" | "due_soon" | "commented" | "status_changed";
  taskId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch (err) {
    logger.warn({ err, userId: params.userId, type: params.type }, "Failed to create notification");
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
