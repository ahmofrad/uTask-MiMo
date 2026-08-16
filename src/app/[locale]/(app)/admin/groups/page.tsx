import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getManagedDepartmentIds } from "@/lib/departments";
import { GroupList } from "@/components/admin/group-list";
import { getTranslations } from "next-intl/server";

export default async function AdminGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Global managers (owner/admin with group:manage) see everything. Department
  // managers get a scoped variant: only groups in their department subtree.
  const isGlobalManager = await can(session.user.id, "group:manage");
  const managedDepartmentIds = isGlobalManager ? null : await getManagedDepartmentIds(session.user.id);
  if (!isGlobalManager && (managedDepartmentIds === null || managedDepartmentIds.length === 0)) {
    redirect("/");
  }

  const t = await getTranslations("admin");

  const groupsRaw = await prisma.ldapSyncGroup.findMany({
    where: {
      deletedAt: null,
      ...(!isGlobalManager && managedDepartmentIds
        ? {
            OR: [
              { ownerDepartmentId: { in: managedDepartmentIds } },
              { department: { id: { in: managedDepartmentIds } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { memberships: true } },
      department: { select: { id: true, name: true } },
      ownerDepartment: { select: { id: true, name: true } },
    },
  });

  const groups = groupsRaw.map((group) => ({
    id: group.id,
    name: group.name,
    dn: group.dn ?? null,
    lastSyncedAt: group.lastSyncedAt?.toISOString() ?? null,
    memberCount: group._count.memberships,
    department: group.department,
    ownerDepartment: group.ownerDepartment,
    ownerDepartmentId: group.ownerDepartmentId,
    source: group.source,
  }));

  // Scoped managers see only their subtree; count how many groups exist
  // overall so the UI can explain why some groups are hidden.
  let hiddenGroupCount = 0;
  if (!isGlobalManager) {
    const totalGroups = await prisma.ldapSyncGroup.count({ where: { deletedAt: null } });
    hiddenGroupCount = Math.max(0, totalGroups - groups.length);
  }

  // Owner-department picker: all departments for global managers, the
  // manager's subtree otherwise.
  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(!isGlobalManager && managedDepartmentIds
        ? { id: { in: managedDepartmentIds } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">{t("groups")}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t("groupsDescription")}</p>
      </div>
      <GroupList
        groups={groups}
        departments={departments}
        canSearchAd={isGlobalManager}
        hiddenGroupCount={hiddenGroupCount}
      />
    </div>
  );
}
