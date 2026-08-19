import { cache } from "react";
import { prisma } from "@/lib/db";
import { getManagedDepartmentIds } from "@/lib/departments";
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

export const canProject = cache(
  async function canProject(
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      archivedAt: true,
      department: { select: { id: true, managerUserId: true } },
      departmentLinks: { select: { departmentId: true } },
    },
  });
  if (!project || project.archivedAt !== null) return false;

  // Check project membership
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { projectRole: true, disabledAt: true },
  });
  if (member) {
    const membershipActive = member.disabledAt === null || member.disabledAt === undefined;
    if (membershipActive && hasProjectPermission(member.projectRole as ProjectMemberRole, permission)) {
      return true;
    }
  }

  // Live group grants: a member of a group granted a role on this project
  // inherits that role. Computed at check time, so membership changes apply
  // immediately. Direct membership is checked first; grants are additive.
  const groupRole = await getUserProjectGroupRole(userId, projectId);
  if (groupRole && hasProjectPermission(groupRole, permission)) {
    return true;
  }

  if (project.department?.managerUserId === userId) {
    return hasPermission("manager", permission);
  }

  const linkedDepartmentIds = Array.from(new Set([
    ...(project.department?.id ? [project.department.id] : []),
    ...(project.departmentLinks?.map((link) => link.departmentId) ?? []),
  ]));
  if (linkedDepartmentIds.length > 0) {
    const managedDepartmentIds = await getManagedDepartmentIds(userId);
    return linkedDepartmentIds.some((id) => managedDepartmentIds.includes(id)) && hasPermission("manager", permission);
  }

  return false;
  },
);

const PROJECT_ROLE_RANK: Record<ProjectMemberRole, number> = {
  viewer: 1,
  contributor: 2,
  lead: 3,
};

/**
 * Highest project role the user inherits from groups granted a role on the
 * project. Grants are computed live from `ProjectGroupGrant` + current
 * memberships, so membership changes propagate immediately.
 */
const getUserProjectGroupRole = cache(
  async function getUserProjectGroupRole(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberRole | null> {
  const grants = await prisma.projectGroupGrant.findMany({
    where: {
      projectId,
      group: {
        deletedAt: null,
        memberships: { some: { userId } },
      },
    },
    select: { role: true },
  });
  if (grants.length === 0) return null;
  let best: ProjectMemberRole | null = null;
  for (const grant of grants) {
    if (!best || PROJECT_ROLE_RANK[grant.role] > PROJECT_ROLE_RANK[best]) {
      best = grant.role;
    }
  }
  return best;
  },
);

/**
 * Whether a user can manage a group. Owner/admin override. Managers are
 * scoped: the group's owning department (or its linked department, for LDAP
 * groups) must be inside the user's managed department subtree.
 */
export const canManageGroup = cache(
  async function canManageGroup(
    userId: string,
    groupId: string,
  ): Promise<boolean> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole && (globalRole.type === "owner" || globalRole.type === "admin")) {
    return true;
  }

  const group = await prisma.ldapSyncGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      ownerDepartmentId: true,
      department: { select: { id: true } },
    },
  });
  if (!group) return false;

  const departmentId = group.ownerDepartmentId ?? group.department?.id ?? null;
  if (!departmentId) return false;

  const managedDepartmentIds = await getManagedDepartmentIds(userId);
  return managedDepartmentIds.includes(departmentId);
  },
);

export const canCreateProject = cache(
  async function canCreateProject(userId: string, departmentId?: string | null): Promise<boolean> {
  const { globalRole } = await getUserRole(userId);
  if (globalRole === "owner" || globalRole === "admin") return true;
  if (!departmentId) return false;

  const managedDepartmentIds = await getManagedDepartmentIds(userId);
  return managedDepartmentIds.includes(departmentId);
  },
);

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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

  // A member of a group granted any role on the project can read it.
  if ((await getUserProjectGroupRole(userId, projectId)) !== null) return true;

  if (project.department?.managerUserId === userId) return true;

  const linkedDepartmentIds = Array.from(new Set([
    ...(project.department?.id ? [project.department.id] : []),
    ...(project.departmentLinks?.map((link) => link.departmentId) ?? []),
  ]));
  if (linkedDepartmentIds.length > 0) {
    const managedDepartmentIds = await getManagedDepartmentIds(userId);
    return linkedDepartmentIds.some((id) => managedDepartmentIds.includes(id));
  }

  return false;
});

export const canReadTask = cache(
  async function canReadTask(userId: string, taskId: string): Promise<boolean> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, deletedAt: true },
    });
    if (!task || task.deletedAt) return false;
    return canReadProject(userId, task.projectId);
  },
);

export const canEditTask = cache(
  async function canEditTask(userId: string, taskId: string): Promise<boolean> {
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
  },
);

export const isProjectOwner = cache(
  async function isProjectOwner(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    return project?.ownerId === userId;
  },
);
