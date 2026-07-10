import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { AdminUserList } from "@/components/admin/user-list";
import { getTranslations } from "next-intl/server";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "user:manage");
  if (!allowed) redirect("/");

  const t = await getTranslations("admin");

  const usersRaw = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      ldapGroup: true,
      lastLoginAt: true,
      createdAt: true,
      roles: {
        where: { scopeType: "global" },
        select: { type: true },
      },
    },
  });

  const users = usersRaw.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("users")}</h1>
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <AdminUserList users={users} />
      </div>
    </div>
  );
}
