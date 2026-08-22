import { prisma } from "@/lib/db";
import { collectDepartmentSubtreeIds } from "@/lib/departments/scope";

export async function listDepartments() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
    },
  });
}

export async function getDepartmentById(id: string) {
  return prisma.department.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { projects: true } },
    },
  });
}

export async function listDepartmentManagerCandidates(departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { ldapSyncGroupId: true },
  });
  if (!department) return [];

  // LDAP-backed departments can only be managed by an active member of the
  // synced group; manual departments draw from all active users.
  const where =
    department.ldapSyncGroupId
      ? {
          status: "active" as const,
          ldapMemberships: {
            some: {
              ldapSyncGroupId: department.ldapSyncGroupId,
              group: { deletedAt: null },
            },
          },
        }
      : { status: "active" as const };

  return prisma.user.findMany({
    where,
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });
}

export async function listProjectLinkDepartments(projectId: string) {
  const links = await prisma.projectDepartment.findMany({
    where: { projectId },
    select: { departmentId: true },
  });
  const linkedIds = links.map((link) => link.departmentId);

  return prisma.department.findMany({
    where: {
      deletedAt: null,
      id: { notIn: linkedIds },
    },
    select: { id: true, name: true, parentId: true, source: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Departments the current user may create projects in. Owners/admins may
 * create in any department (or none); other roles are scoped to the subtree
 * they manage. `required` is true when the caller must pick a department.
 */
export async function listCreatableDepartments(userId: string): Promise<{
  departments: { id: string; name: string; parentId: string | null }[];
  required: boolean;
}> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  const isOrgWide =
    globalRole?.type === "owner" || globalRole?.type === "admin";
  const managedIds = isOrgWide ? null : await getManagedDepartmentIds(userId);
  if (managedIds !== null && managedIds.length === 0) {
    return { departments: [], required: true };
  }
  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(managedIds ? { id: { in: managedIds } } : {}),
    },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });
  return { departments, required: !isOrgWide };
}

export type DepartmentMember = {
  id: string;
  displayName: string;
  email: string;
  joinedAt: string | null;
};

export async function listDepartmentMembers(departmentId: string): Promise<DepartmentMember[]> {
  const memberships = await prisma.departmentMembership.findMany({
    where: { departmentId },
    select: {
      createdAt: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    displayName: m.user.displayName,
    email: m.user.email,
    joinedAt: m.createdAt.toISOString(),
  }));
}

export async function addDepartmentMember(departmentId: string, userId: string) {
  await prisma.departmentMembership.upsert({
    where: { userId_departmentId: { userId, departmentId } },
    create: { userId, departmentId },
    update: {},
  });
}

export async function removeDepartmentMember(departmentId: string, userId: string) {
  await prisma.departmentMembership.deleteMany({
    where: { userId, departmentId },
  });
}

/**
 * All active users eligible for department membership (excludes guests).
 * Used by the admin UI to populate department-assignment pickers.
 */
export async function listDepartmentMemberCandidates() {
  return prisma.user.findMany({
    where: { status: "active" },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });
}

export async function createDepartment(data: {
  name: string;
  parentId?: string | null;
  managerUserId?: string | null;
}) {
  const managerUserId = data.managerUserId ?? null;
  return prisma.department.create({
    data: {
      name: data.name,
      parentId: data.parentId ?? null,
      managerUserId,
      managerSource: managerUserId ? "manual" : null,
    },
  });
}

async function hasCycle(departmentId: string, newParentId: string): Promise<boolean> {
  let currentId: string | null = newParentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === departmentId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const found: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = found?.parentId ?? null;
  }
  return false;
}

export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    parentId?: string | null;
    managerUserId?: string | null;
  },
) {
  if (data.managerUserId) {
    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: { source: true, ldapSyncGroupId: true },
    });
    if (department?.source === "ldap") {
      const manager = await prisma.user.findUnique({
        where: { id: data.managerUserId },
        select: { status: true },
      });
      const membership = department.ldapSyncGroupId
        ? await prisma.ldapGroupMembership.findUnique({
            where: {
              userId_ldapSyncGroupId: {
                userId: data.managerUserId,
                ldapSyncGroupId: department.ldapSyncGroupId,
              },
            },
            select: { userId: true },
          })
        : null;
      if (manager?.status !== "active" || !membership) {
        throw new Error("Department manager must be an active LDAP-synchronized member");
      }
    } else {
      // Manual departments may be managed by any active user.
      const manager = await prisma.user.findUnique({
        where: { id: data.managerUserId },
        select: { status: true },
      });
      if (manager?.status !== "active") {
        throw new Error("Department manager must be an active user");
      }
    }
  }

  if (data.parentId !== undefined && data.parentId !== null) {
    if (await hasCycle(id, data.parentId)) {
      throw new Error("Setting this parent would create a cycle");
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.managerUserId !== undefined) {
    // An explicit choice (or clearing) overrides the AD-sourced manager until
    // the next manual change; AD re-fills only when the source is not manual.
    updateData.managerUserId = data.managerUserId;
    updateData.managerSource = data.managerUserId ? "manual" : null;
  }

  return prisma.department.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteDepartment(id: string) {
  return prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function ensureLdapDepartment(group: { id: string; name: string }) {
  const existing = await prisma.department.findUnique({
    where: { ldapSyncGroupId: group.id },
  });

  if (existing) {
    if (existing.source !== "ldap") {
      throw new Error("An LDAP group cannot be attached to a manual department");
    }

    const department = await prisma.department.update({
      where: { id: existing.id },
      data: { name: group.name, deletedAt: null },
    });

    return {
      department,
      created: false,
      renamed: existing.name !== group.name,
    };
  }

  const department = await prisma.department.create({
    data: {
      name: group.name,
      source: "ldap",
      ldapSyncGroupId: group.id,
      deletedAt: null,
    },
  });

  return { department, created: true, renamed: false };
}

export async function getManagedDepartmentIds(userId: string): Promise<string[]> {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      parentId: true,
      managerUserId: true,
      manager: { select: { status: true } },
    },
  });

  const managedDepartmentIds = new Set<string>();
  for (const department of departments) {
    if (department.managerUserId !== userId || department.manager?.status !== "active") continue;
    collectDepartmentSubtreeIds(department.id, departments).forEach((id) => {
      managedDepartmentIds.add(id);
    });
  }

  return Array.from(managedDepartmentIds);
}
