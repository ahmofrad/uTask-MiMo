import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { getLdapConfig, searchLdapGroups } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";
import { ensureLdapDepartment } from "@/lib/departments";
import { ldapGroupSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const q = new URL(request.url).searchParams.get("q") ?? "";

  // No query → list the already-selected sync groups (always available, even if LDAP is off).
  if (!q.trim()) {
    const groups = await prisma.ldapSyncGroup.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: groups });
  }

  const config = await getLdapConfig();
  if (!config || !config.enabled) {
    return NextResponse.json({ data: [] });
  }

  const groups = await searchLdapGroups(config, q.trim());
  return NextResponse.json({ data: groups });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = ldapGroupSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { dn, name } = parsed.data;

  const group = await prisma.ldapSyncGroup.upsert({
    where: { dn },
    create: { dn, name },
    update: { name, deletedAt: null },
  });

  const departmentResult = await ensureLdapDepartment({ id: group.id, name: group.name });

  if (departmentResult.created) {
    await logAudit({
      actorUserId: userId,
      action: "department_created",
      entityType: "department",
      entityId: departmentResult.department.id,
      after: departmentResult.department as never,
    });
  } else if (departmentResult.renamed) {
    await logAudit({
      actorUserId: userId,
      action: "department_updated",
      entityType: "department",
      entityId: departmentResult.department.id,
      after: departmentResult.department as never,
    });
  }

  await logAudit({
    actorUserId: userId,
    action: "ldap_group_added",
    entityType: "ldapgroup",
    entityId: group.id,
    after: { dn, name, departmentId: departmentResult.department.id },
  });

  return NextResponse.json({ data: { ...group, department: departmentResult.department } });
}