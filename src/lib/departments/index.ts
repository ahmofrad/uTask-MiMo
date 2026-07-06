import { prisma } from "@/lib/db";

export async function listDepartments() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
    },
  });
}

export async function getDepartmentById(id: string) {
  return prisma.department.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { projects: true } },
    },
  });
}

export async function createDepartment(data: {
  name: string;
  parentId?: string | null;
  managerUserId?: string | null;
}) {
  return prisma.department.create({
    data: {
      name: data.name,
      parentId: data.parentId ?? null,
      managerUserId: data.managerUserId ?? null,
    },
  });
}

export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    parentId?: string | null;
    managerUserId?: string | null;
  },
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.managerUserId !== undefined)
    updateData.managerUserId = data.managerUserId;

  return prisma.department.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteDepartment(id: string) {
  return prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
