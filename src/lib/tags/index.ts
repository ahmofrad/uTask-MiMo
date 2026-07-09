import { prisma } from "@/lib/db";

export async function getTagsByProject(projectId: string) {
  return prisma.tag.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function createTag(name: string, color: string, projectId?: string) {
  return prisma.tag.create({
    data: { name: name.trim(), color, projectId: projectId ?? null },
  });
}

export async function updateTag(id: string, data: { name?: string; color?: string }) {
  return prisma.tag.update({ where: { id }, data });
}

export async function deleteTag(id: string) {
  await prisma.taskTag.deleteMany({ where: { tagId: id } });
  return prisma.tag.delete({ where: { id } });
}

export async function assignTagsToTask(taskId: string, tagIds: string[]) {
  // Remove existing tags
  await prisma.taskTag.deleteMany({ where: { taskId } });

  // Add new tags
  if (tagIds.length > 0) {
    await prisma.taskTag.createMany({
      data: tagIds.map((tagId) => ({ taskId, tagId })),
    });
  }
}

export async function getTaskTagIds(taskId: string): Promise<string[]> {
  const rows = await prisma.taskTag.findMany({
    where: { taskId },
    select: { tagId: true },
  });
  return rows.map((r) => r.tagId);
}