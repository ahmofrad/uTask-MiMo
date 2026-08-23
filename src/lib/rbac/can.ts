import { cache } from "react";
import { prisma } from "@/lib/db";
import { getManagedDepartmentIds } from "@/lib/departments";
import type { RoleType, Permission, ProjectMemberRole } from "@/lib/rbac/roles";
import { hasPermission, hasProjectPermission } from "@/lib/rbac/roles";

export type UserRoleInfo = {
  userId: string;
  globalRole: RoleType | null;
};

export const getUserRole = cache(async (
  userId: string,
  organizationId?: string,
): Promise<UserRoleInfo> => {
  const globalRole = await prisma.role.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}), scopeType: "global", scopeId: null },
    select: { type: true },
  });
  return { userId, globalRole: (globalRole?.type as RoleType) ?? null };
});

export const can = cache(async (
  userId: string,
  permission: Permission,
  organizationId?: string,
): Promise<boolean> => {
  const role = await prisma.role.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}), scopeType: "global", scopeId: null },
    select: { type: true },
  });
  return role ? hasPermission(role.type as RoleType, permission) : false;
});

export const canProject = cache(async function canProject(
  userId: string,
  permission: Permission,
  projectId: string,
  organizationId?: string,
): Promise<boolean> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}), scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) return true;

  const projectDelegate = prisma.project as typeof prisma.project & {
    findFirst?: typeof prisma.project.findFirst;
  };
  const project = await (projectDelegate.findFirst ?? prisma.project.findUnique)({
    where: { id: projectId, ...(organizationId ? { organizationId } : {}) },
    select: {
      archivedAt: true,
      department: { select: { id: true, managerUserId: true } },
      departmentLinks: { select: { departmentId: true } },
    },
  });
  if (!project || project.archivedAt !== null) return false;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { projectRole: true, disabledAt: true },
  });
  if (member && (member.disabledAt === null || member.disabledAt === undefined)
    && hasProjectPermission(member.projectRole as ProjectMemberRole, permission)) {
    return true;
  }

  const groupRole = await getUserProjectGroupRole(userId, projectId, organizationId);
  if (groupRole && hasProjectPermission(groupRole, permission)) return true;

  if (project.department?.managerUserId === userId) return hasPermission("manager", permission);

  const linkedDepartmentIds = Array.from(new Set([
    ...(project.department?.id ? [project.department.id] : []),
    ...(project.departmentLinks?.map((link) => link.departmentId) ?? []),
  ]));
  if (linkedDepartmentIds.length === 0) return false;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
  return linkedDepartmentIds.some((id) => managedDepartmentIds.includes(id))
    && hasPermission("manager", permission);
});

const PROJECT_ROLE_RANK: Record<ProjectMemberRole, number> = {
  viewer: 1,
  contributor: 2,
  lead: 3,
};

const getUserProjectGroupRole = cache(async function getUserProjectGroupRole(
  userId: string,
  projectId: string,
  organizationId?: string,
): Promise<ProjectMemberRole | null> {
  const grants = await prisma.projectGroupGrant.findMany({
    where: {
      projectId,
      ...(organizationId ? { project: { organizationId } } : {}),
      group: { deletedAt: null, memberships: { some: { userId } } },
    },
    select: { role: true },
  });
  let best: ProjectMemberRole | null = null;
  for (const grant of grants) {
    if (!best || PROJECT_ROLE_RANK[grant.role] > PROJECT_ROLE_RANK[best]) best = grant.role;
  }
  return best;
});

export const canManageGroup = cache(async function canManageGroup(
  userId: string,
  groupId: string,
  organizationId?: string,
): Promise<boolean> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}), scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) return true;

  const group = await prisma.ldapSyncGroup.findFirst({
    where: { id: groupId, ...(organizationId ? { organizationId } : {}), deletedAt: null },
    select: { ownerDepartmentId: true, department: { select: { id: true } } },
  });
  if (!group) return false;
  const departmentId = group.ownerDepartmentId ?? group.department?.id ?? null;
  if (!departmentId) return false;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
  return managedDepartmentIds.includes(departmentId);
});

export const canAccessDepartment = cache(async function canAccessDepartment(
  userId: string,
  departmentId: string,
  organizationId?: string,
): Promise<boolean> {
  const { globalRole } = await getUserRole(userId, organizationId);
  if (globalRole === "owner" || globalRole === "admin") return true;

  const department = await prisma.department.findFirst({
    where: { id: departmentId, ...(organizationId ? { organizationId } : {}), deletedAt: null },
    select: { managerUserId: true },
  });
  if (!department) return false;
  if (department.managerUserId === userId) return true;

  const membership = await prisma.departmentMembership.findUnique({
    where: { userId_departmentId: { userId, departmentId } },
    select: { userId: true },
  });
  if (membership) return true;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
  return managedDepartmentIds.includes(departmentId);
});

export const canCreateProject = cache(async function canCreateProject(
  userId: string,
  departmentId?: string | null,
  organizationId?: string,
): Promise<boolean> {
  const { globalRole } = await getUserRole(userId, organizationId);
  if (globalRole === "owner" || globalRole === "admin") return true;
  if (!departmentId) return false;
  const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
  return managedDepartmentIds.includes(departmentId);
});

export const canReadProject = cache(async function canReadProject(
  userId: string,
  projectId: string,
  organizationId?: string,
): Promise<boolean> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}), scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) return true;

  const projectDelegate = prisma.project as typeof prisma.project & {
    findFirst?: typeof prisma.project.findFirst;
  };
  const project = await (projectDelegate.findFirst ?? prisma.project.findUnique)({
    where: { id: projectId, ...(organizationId ? { organizationId } : {}) },
    select: {
      archivedAt: true,
      department: { select: { id: true, managerUserId: true } },
      departmentLinks: { select: { departmentId: true } },
    },
  });
  if (!project || project.archivedAt !== null) return false;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { disabledAt: true },
  });
  if (member && (member.disabledAt === null || member.disabledAt === undefined)) return true;
  if ((await getUserProjectGroupRole(userId, projectId, organizationId)) !== null) return true;
  if (project.department?.managerUserId === userId) return true;

  const linkedDepartmentIds = Array.from(new Set([
    ...(project.department?.id ? [project.department.id] : []),
    ...(project.departmentLinks?.map((link) => link.departmentId) ?? []),
  ]));
  const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
  return linkedDepartmentIds.some((id) => managedDepartmentIds.includes(id));
});

export const canReadTask = cache(async function canReadTask(
  userId: string,
  taskId: string,
  organizationId?: string,
): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) return false;
  return canReadProject(userId, task.projectId, organizationId);
});

export const canEditTask = cache(async function canEditTask(
  userId: string,
  taskId: string,
  organizationId?: string,
): Promise<boolean> {
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
  if (await canProject(userId, "task:edit_any", task.projectId, organizationId)) return true;
  if (!(await canProject(userId, "task:edit_own", task.projectId, organizationId))) return false;
  return task.createdById === userId || task.reporterId === userId
    || task.assignees.some((assignee) => assignee.userId === userId);
});

export const isProjectOwner = cache(async function isProjectOwner(
  userId: string,
  projectId: string,
  organizationId?: string,
): Promise<boolean> {
  const projectDelegate = prisma.project as typeof prisma.project & {
    findFirst?: typeof prisma.project.findFirst;
  };
  const project = await (projectDelegate.findFirst ?? prisma.project.findUnique)({
    where: { id: projectId, ...(organizationId ? { organizationId } : {}) },
    select: { ownerId: true },
  });
  return project?.ownerId === userId;
});
