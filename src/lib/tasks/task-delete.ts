import { prisma } from "@/lib/db";

/**
 * Soft-deletes a task by stamping deletedAt. All list/query paths filter
 * `WHERE deletedAt IS NULL`, so the row disappears from every surface while
 * remaining recoverable and audit-safe.
 */
export async function deleteTask(id: string) {
  const before = await prisma.task.findUnique({ where: { id } });

  await prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return { before };
}