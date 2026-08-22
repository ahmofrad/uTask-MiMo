import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { DepartmentTree } from "@/components/admin/department-tree";
import { getTranslations } from "next-intl/server";

export default async function AdminDepartmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "org:settings");
  if (!allowed) redirect("/");

  const t = await getTranslations("admin");

  const departmentsRaw = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true, members: true } },
      ldapSyncGroup: {
        select: { _count: { select: { memberships: true } } },
      },
      manager: { select: { displayName: true } },
    },
  });

  const departments = departmentsRaw.map((department) => ({
    id: department.id,
    name: department.name,
    parentId: department.parentId,
    managerUserId: department.managerUserId,
    managerSource: department.managerSource,
    managerName: department.manager?.displayName ?? null,
    source: department.source,
    ldapSyncGroupId: department.ldapSyncGroupId,
    projectsCount: department._count.projects,
    // LDAP-backed departments show the group membership count; manual ones
    // show the DepartmentMembership count.
    memberCount: department.ldapSyncGroupId
      ? department.ldapSyncGroup?._count.memberships ?? 0
      : department._count.members,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("departments")}</h1>
      </div>
      <DepartmentTree departments={departments} />
    </div>
  );
}
