import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getManagedDepartmentIds } from "@/lib/departments";
import { logAudit } from "@/lib/audit/log";
import { createManualGroup, listGroups } from "@/lib/groups";
import { groupCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const isGlobalManager = await can(userId, "group:manage", organizationId);
  let groups;
  if (isGlobalManager) {
    groups = await listGroups(organizationId);
  } else {
    const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
    if (managedDepartmentIds.length === 0) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }
    // Scoped managers see only groups in their department subtree (owning
    // department, or the linked department for AD-synced groups).
    groups = await listGroupsScoped(managedDepartmentIds, organizationId);
  }

  return NextResponse.json({ data: groups });
}

async function listGroupsScoped(managedDepartmentIds: string[], organizationId: string) {
  const rows = await prisma.ldapSyncGroup.findMany({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { ownerDepartmentId: { in: managedDepartmentIds } },
        { department: { id: { in: managedDepartmentIds } } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { memberships: true } },
      ownerDepartment: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
  return rows.map((group) => ({
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

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const parsed = groupCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, ownerDepartmentId } = parsed.data;

  const isGlobalManager = await can(userId, "group:manage", organizationId);
  if (!isGlobalManager) {
    // Scoped manager: the group must belong to a department in their subtree.
    const managedDepartmentIds = await getManagedDepartmentIds(userId, organizationId);
    if (!ownerDepartmentId || !managedDepartmentIds.includes(ownerDepartmentId)) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }
  }

  if (ownerDepartmentId) {
    const department = await prisma.department.findFirst({
      where: { id: ownerDepartmentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Owner department not found" } }, { status: 404 });
    }
  }

  const group = await createManualGroup({ organizationId, name, ownerDepartmentId: ownerDepartmentId ?? null });

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "group_created",
    entityType: "group",
    entityId: group.id,
    after: { name: group.name, source: group.source, ownerDepartmentId: group.ownerDepartmentId },
  });

  return NextResponse.json({ data: group }, { status: 201 });
}
