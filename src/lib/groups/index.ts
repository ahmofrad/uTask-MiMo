import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import type { ProjectMemberRole } from "@/lib/rbac/roles";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

export type GroupListItem = {
  id: string;
  name: string;
  source: "ldap" | "manual";
  dn: string | null;
  lastSyncedAt: Date | null;
  memberCount: number;
  ownerDepartment: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
};

/**
 * Soft-deletes a group. For AD-synced groups this also archives the linked
 * department and disables access for users whose only membership was this
 * group. Manual groups are deleted without touching users or departments —
 * their members were added by hand.
 */
export async function deleteGroup(groupId: string, actorUserId: string) {
  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: groupId },
    include: { department: { select: { id: true } } },
  });
  if (!group) return null;

  const isLdapGroup = group.source === "ldap";

  let orphanedUserIds: string[] = [];
  if (isLdapGroup) {
    const memberships = await prisma.ldapGroupMembership.findMany({
      where: { ldapSyncGroupId: group.id },
      select: { userId: true },
    });
    const affectedUserIds = [...new Set(memberships.map((membership) => membership.userId))];

    const remainingMemberships = affectedUserIds.length > 0
      ? await prisma.ldapGroupMembership.findMany({
          where: { userId: { in: affectedUserIds }, group: { deletedAt: null } },
          select: { userId: true },
        })
      : [];
    const remainingUserIds = new Set(remainingMemberships.map((membership) => membership.userId));
    orphanedUserIds = affectedUserIds.filter((userId) => !remainingUserIds.has(userId));

    if (orphanedUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: orphanedUserIds } },
        data: { status: "ldapGroupRemoved", ldapGroupId: null },
      });
      await prisma.projectMember.updateMany({
        where: { userId: { in: orphanedUserIds } },
        data: { disabledAt: new Date(), disabledReason: "ldap" },
      });
    }

    if (group.department) {
      await prisma.department.update({
        where: { id: group.department.id },
        data: { deletedAt: new Date() },
      });
      await logAudit({
        actorUserId,
        action: "department_deleted",
        entityType: "department",
        entityId: group.department.id,
        before: { sourceGroupId: group.id },
        after: { deletedAt: true },
      });
    }
  }

  await prisma.ldapSyncGroup.update({
    where: { id: group.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId,
    action: "group_deleted",
    entityType: "group",
    entityId: group.id,
    before: { dn: group.dn, name: group.name, source: group.source },
    after: { usersAffected: orphanedUserIds.length },
  });

  return { usersAffected: orphanedUserIds.length };
}

/**
 * Adds a user to a group as a manual membership (`sourceMemberDn IS NULL`).
 * On AD-synced groups this is the hybrid path — the member survives sync.
 * Returns `created: false` when the user is already a member, so callers can
 * avoid double-adding rows or re-emitting audit events.
 */
export async function addGroupMember(groupId: string, memberUserId: string): Promise<{
  membership: { userId: string; ldapSyncGroupId: string; sourceMemberDn: string | null };
  created: boolean;
}> {
  const existing = await prisma.ldapGroupMembership.findUnique({
    where: {
      userId_ldapSyncGroupId: { userId: memberUserId, ldapSyncGroupId: groupId },
    },
  });
  if (existing) {
    return { membership: existing, created: false };
  }
  const membership = await prisma.ldapGroupMembership.create({
    data: { userId: memberUserId, ldapSyncGroupId: groupId, sourceMemberDn: null },
  });
  return { membership, created: true };
}

export async function removeGroupMember(groupId: string, memberUserId: string) {
  const membership = await prisma.ldapGroupMembership.findUnique({
    where: {
      userId_ldapSyncGroupId: { userId: memberUserId, ldapSyncGroupId: groupId },
    },
  });
  if (!membership) return null;
  await prisma.ldapGroupMembership.delete({
    where: {
      userId_ldapSyncGroupId: { userId: memberUserId, ldapSyncGroupId: groupId },
    },
  });
  return membership;
}

export async function listGroupMembers(groupId: string) {
  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: groupId },
    select: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { user: { displayName: "asc" } },
  });
  return memberships.map((membership) => membership.user);
}

export async function listGroups(organizationId = DEFAULT_ORGANIZATION_ID): Promise<GroupListItem[]> {
  const groups = await prisma.ldapSyncGroup.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { memberships: true } },
      ownerDepartment: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    source: group.source,
    dn: group.dn,
    lastSyncedAt: group.lastSyncedAt,
    memberCount: group._count.memberships,
    ownerDepartment: group.ownerDepartment,
    department: group.department,
  }));
}

export async function createManualGroup(data: {
  organizationId?: string;
  name: string;
  ownerDepartmentId?: string | null;
}) {
  return prisma.ldapSyncGroup.create({
    data: {
      organizationId: data.organizationId ?? DEFAULT_ORGANIZATION_ID,
      name: data.name,
      source: "manual",
      dn: null,
      ownerDepartmentId: data.ownerDepartmentId ?? null,
    },
  });
}

export async function updateGroup(
  groupId: string,
  data: { name?: string; ownerDepartmentId?: string | null },
) {
  return prisma.ldapSyncGroup.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.ownerDepartmentId !== undefined
        ? { ownerDepartmentId: data.ownerDepartmentId }
        : {}),
    },
  });
}

export async function grantGroupProjectRole(
  projectId: string,
  groupId: string,
  role: ProjectMemberRole,
  grantedBy: string,
) {
  const grant = await prisma.projectGroupGrant.upsert({
    where: { projectId_groupId: { projectId, groupId } },
    create: { projectId, groupId, role, grantedBy },
    update: { role },
  });
  return grant;
}

export async function revokeGroupProjectRole(projectId: string, groupId: string) {
  const grant = await prisma.projectGroupGrant.findUnique({
    where: { projectId_groupId: { projectId, groupId } },
  });
  if (!grant) return null;
  await prisma.projectGroupGrant.delete({
    where: { projectId_groupId: { projectId, groupId } },
  });
  return grant;
}

export async function listProjectGroupGrants(projectId: string) {
  const grants = await prisma.projectGroupGrant.findMany({
    where: { projectId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          source: true,
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { grantedAt: "asc" },
  });
  return grants.map((grant) => ({
    groupId: grant.groupId,
    role: grant.role,
    grantedAt: grant.grantedAt,
    memberCount: grant.group._count.memberships,
    group: {
      id: grant.group.id,
      name: grant.group.name,
      source: grant.group.source,
    },
  }));
}
