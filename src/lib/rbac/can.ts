import { cache } from "react";
import { prisma } from "@/lib/db";
import type { RoleType, Permission, ProjectMemberRole } from "@/lib/rbac/roles";
import { hasPermission, hasProjectPermission } from "@/lib/rbac/roles";

export type UserRoleInfo = {
  userId: string;
  globalRole: RoleType | null;
};

export const getUserRole = cache(async (userId: string): Promise<UserRoleInfo> => {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  return {
    userId,
    globalRole: (globalRole?.type as RoleType) ?? null,
  };
});

export const can = cache(
  async (
    userId: string,
    permission: Permission,
  ): Promise<boolean> => {
    const role = await prisma.role.findFirst({
      where: { userId, scopeType: "global", scopeId: null },
      select: { type: true },
    });
    if (!role) return false;
    return hasPermission(role.type as RoleType, permission);
  },
);

export async function canProject(
  userId: string,
  permission: Permission,
  projectId: string,
): Promise<boolean> {
  // Global admin/owner override all project restrictions
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) {
    return true;
  }

  // Check project membership
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { projectRole: true, project: { select: { archivedAt: true } } },
  });
  if (member) {
    return member.project.archivedAt === null && hasProjectPermission(member.projectRole as ProjectMemberRole, permission);
  }

  if (globalRole?.type === "manager") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { archivedAt: true, department: { select: { managerUserId: true } } },
    });
    return project?.archivedAt === null && project.department?.managerUserId === userId && hasPermission("manager", permission);
  }

  return false;
}

export async function canCreateProject(userId: string, departmentId?: string | null): Promise<boolean> {
  const { globalRole } = await getUserRole(userId);
  if (globalRole === "owner" || globalRole === "admin") return true;
  if (globalRole !== "manager" || !departmentId) return false;

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { managerUserId: true, deletedAt: true },
  });
  return department?.deletedAt === null && department.managerUserId === userId;
}

/**
 * Read access is membership-based. Mutation permissions are intentionally not
 * used here: viewers and contributors must be able to read projects without
 * receiving edit permissions.
 */
export const canReadProject = cache(async (userId: string, projectId: string): Promise<boolean> => {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) {
    return true;
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { project: { select: { archivedAt: true } } },
  });
  if (member?.project.archivedAt === null) return true;

  if (globalRole?.type === "manager") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { archivedAt: true, department: { select: { managerUserId: true } } },
    });
    return project?.archivedAt === null && project.department?.managerUserId === userId;
  }

  return false;
});

export async function canReadTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) return false;
  return canReadProject(userId, task.projectId);
}

export async function canEditTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      deletedAt: true,
      createdById: true,
      reporterId: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task || task.deletedAt) return false;
  if (await canProject(userId, "task:edit_any", task.projectId)) return true;
  if (!(await canProject(userId, "task:edit_own", task.projectId))) return false;
  return task.createdById === userId || task.reporterId === userId || task.assignees.some((assignee) => assignee.userId === userId);
}

export async function isProjectOwner(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  return project?.ownerId === userId;
}
