import { prisma } from "@/lib/db";

export async function addWatcher(taskId: string, userId: string) {
  const existing = await prisma.watcher.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) return existing;

  return prisma.watcher.create({
    data: { taskId, userId },
  });
}

export async function removeWatcher(taskId: string, userId: string) {
  return prisma.watcher.deleteMany({
    where: { taskId, userId },
  });
}

export async function getWatchers(taskId: string) {
  return prisma.watcher.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });
}

export async function ensureWatcher(taskId: string, userId: string) {
  if (!userId) return;
  try {
    await addWatcher(taskId, userId);
  } catch {
    // ignore unique violation
  }
}

export async function autoWatchTask(taskId: string, ...userIds: (string | null | undefined)[]) {
  for (const uid of userIds) {
    if (uid) await ensureWatcher(taskId, uid);
  }
}
