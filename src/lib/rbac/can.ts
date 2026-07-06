import { prisma } from "@/lib/db";
import type { RoleType, Permission, ProjectMemberRole } from "@/lib/rbac/roles";
import { hasPermission, hasProjectPermission } from "@/lib/rbac/roles";

export type UserRoleInfo = {
  userId: string;
  globalRole: RoleType | null;
};

export async function getUserRole(userId: string): Promise<UserRoleInfo> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  return {
    userId,
    globalRole: (globalRole?.type as RoleType) ?? null,
  };
}

export async function can(
  userId: string,
  permission: Permission,
): Promise<boolean> {
  const role = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (!role) return false;
  return hasPermission(role.type as RoleType, permission);
}

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
    select: { projectRole: true },
  });
  if (!member) return false;
  return hasProjectPermission(member.projectRole as ProjectMemberRole, permission);
}
