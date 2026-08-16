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

  // Invited users carry a pending invite token; surface its expiry so admins
  // know when the accept link stops working and a resend is needed.
  const invitedIds = usersRaw.filter((u) => u.status === "invited").map((u) => u.id);
  const inviteTokens = invitedIds.length
    ? await prisma.verificationToken.findMany({
        where: { identifier: { in: invitedIds } },
        select: { identifier: true, expires: true },
      })
    : [];
  const inviteExpiry = new Map(inviteTokens.map((t) => [t.identifier, t.expires.getTime()]));

  const users = usersRaw.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    inviteExpiresAt: inviteExpiry.get(u.id) ? new Date(inviteExpiry.get(u.id)!).toISOString() : null,
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
