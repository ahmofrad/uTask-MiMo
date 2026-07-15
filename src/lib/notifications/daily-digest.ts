import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/queue";
import { logger } from "@/lib/logging";

export async function sendDailyDigests(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { status: "active" },
    select: { id: true, email: true, displayName: true },
  });

  for (const user of users) {
    try {
      const [overdueTasks, dueToday, unreadNotifications, assignedActive] = await Promise.all([
        prisma.task.count({
          where: {
            assignees: { some: { userId: user.id } },
            deletedAt: null,
            dueDate: { lt: new Date() },
            status: { not: "done" },
          },
        }),
        prisma.task.count({
          where: {
            assignees: { some: { userId: user.id } },
            deletedAt: null,
            dueDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
            status: { not: "done" },
          },
        }),
        prisma.notification.count({
          where: { userId: user.id, readAt: null },
        }),
        prisma.task.count({
          where: { assignees: { some: { userId: user.id } }, deletedAt: null, status: { not: "done" } },
        }),
      ]);

      const subject = `uTask Daily Digest — ${assignedActive} active tasks`;
      const text = [
        `Your uTask Daily Digest`,
        ``,
        `Active tasks: ${assignedActive}`,
        `Due today: ${dueToday}`,
        `Overdue: ${overdueTasks}`,
        `Unread notifications: ${unreadNotifications}`,
        ``,
        `Log in to view your tasks.`,
      ].join("\n");

      await enqueueEmail({ to: user.email, subject, text });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to send daily digest");
    }
  }
}
