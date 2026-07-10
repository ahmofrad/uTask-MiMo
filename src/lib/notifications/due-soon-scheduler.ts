import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";
import { notify } from "@/lib/notifications";

let timer: ReturnType<typeof setTimeout> | null = null;

const WINDOW_MS = 24 * 3_600_000;

async function tick() {
  try {
    const now = new Date();
    const until = new Date(now.getTime() + WINDOW_MS);

    const tasks = await prisma.task.findMany({
      where: {
        dueDate: { gte: now, lte: until },
        status: { not: "done" },
        deletedAt: null,
        assigneeId: { not: null },
      },
      select: { id: true, title: true, assigneeId: true },
    });

    for (const task of tasks) {
      if (!task.assigneeId) continue;
      // Avoid duplicate "due soon" notices within the window.
      const existing = await prisma.notification.findFirst({
        where: {
          userId: task.assigneeId,
          type: "due_soon",
          taskId: task.id,
          createdAt: { gte: new Date(now.getTime() - WINDOW_MS) },
        },
      });
      if (existing) continue;

      await notify({
        userId: task.assigneeId,
        type: "due_soon",
        taskId: task.id,
        payload: { taskTitle: task.title },
      });
    }
  } catch (err) {
    logger.error({ err }, "due-soon notification check failed");
  } finally {
    scheduleNext();
  }
}

function scheduleNext() {
  // Re-check hourly.
  timer = setTimeout(() => void tick(), 3_600_000);
}

export function startDueSoonScheduler() {
  if (timer) return;
  timer = setTimeout(() => void tick(), 60_000);
}

export function stopDueSoonScheduler() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
