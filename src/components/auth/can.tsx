import type { Permission } from "@/lib/rbac/roles";
import { auth } from "@/lib/auth/config";

type CanProps = {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export async function Can({ permission, children, fallback = null }: CanProps) {
  const session = await auth();
  if (!session?.user?.id) return fallback;

  const { can } = await import("@/lib/rbac/can");
  const allowed = await can(session.user.id, permission);
  if (!allowed) return fallback;

  return children;
}
