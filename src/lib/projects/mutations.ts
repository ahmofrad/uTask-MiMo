import { prisma } from "@/lib/db";
import type { ProjectVisibility } from "@prisma/client";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

type CreateProjectData = {
  name: string;
  description?: string | null;
  color?: string;
  ownerId: string;
  organizationId?: string;
  departmentId?: string | null;
  departmentIds?: string[];
  visibility?: ProjectVisibility;
};

export async function createProject(data: CreateProjectData) {
  return prisma.$transaction(async (tx) => {
    const departmentIds = Array.from(new Set(
      data.departmentIds ?? (data.departmentId ? [data.departmentId] : []),
    ));
    const project = await tx.project.create({
      data: {
        organizationId: data.organizationId ?? DEFAULT_ORGANIZATION_ID,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#2563eb",
        ownerId: data.ownerId,
        departmentId: data.departmentId ?? departmentIds[0] ?? null,
        visibility: data.visibility ?? "private",
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: data.ownerId,
        projectRole: "lead",
        addedBy: data.ownerId,
      },
    });

    if (departmentIds.length > 0) {
      await tx.projectDepartment.createMany({
        data: departmentIds.map((departmentId) => ({
          projectId: project.id,
          departmentId,
        })),
        skipDuplicates: true,
      });
    }

    return project;
  });
}

type UpdateProjectData = {
  name?: string;
  description?: string | null;
  color?: string;
  status?: string;
  visibility?: ProjectVisibility;
};

export async function updateProject(id: string, data: UpdateProjectData) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;

  return prisma.project.update({
    where: { id },
    data: updateData,
  });
}

export async function archiveProject(id: string) {
  return prisma.project.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}
