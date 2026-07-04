import { prisma } from "@/lib/db";
import type { RoleType, Permission } from "@/lib/rbac/roles";
import { hasPermission } from "@/lib/rbac/roles";

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
