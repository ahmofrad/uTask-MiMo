import { prisma } from "@/lib/db";

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
