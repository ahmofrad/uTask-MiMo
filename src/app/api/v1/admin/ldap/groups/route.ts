import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { searchLdapGroups, syncLdapGroup } from "@/lib/auth/providers/ldap";
import { getFirstLdapSource, sourceToLdapConfig } from "@/lib/auth/ldap-sources";
import { logAudit } from "@/lib/audit/log";
import { ensureLdapDepartment } from "@/lib/departments";
import { ldapGroupSchema, readJsonBody, validationError } from "@/lib/validation/api";

function parseSourceId(searchParams: URLSearchParams | null, body: unknown): string | null {
  const fromQuery = searchParams?.get("sourceId")?.trim();
  if (fromQuery) return fromQuery;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const candidate = (body as { sourceId?: unknown }).sourceId;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  // No query → list the already-selected sync groups (always available, even if LDAP is off).
  if (!q.trim()) {
    const groups = await prisma.ldapSyncGroup.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: groups });
  }

  const sourceId = parseSourceId(url.searchParams, null);
  const source = sourceId
    ? await prisma.ldapSource.findFirst({ where: { id: sourceId, deletedAt: null } })
    : await getFirstLdapSource();
  if (!source || !source.enabled) {
    return NextResponse.json({ data: [] });
  }

  const config = sourceToLdapConfig(source);
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

  const body = await readJsonBody(request);
  const parsed = ldapGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { dn, name } = parsed.data;

  // POST only ever creates AD-synced groups (manual groups have a separate
  // create path), so dn is guaranteed to be a real directory DN here.
  if (!dn) {
    return NextResponse.json({ error: { code: "validation_error", message: "dn is required for LDAP groups" } }, { status: 400 });
  }

  // The group belongs to the source that was searched (or the first source,
  // for legacy clients that don't pass sourceId). Read from the query string:
  // the body schema is strict and must stay sourceId-free.
  const sourceId = parseSourceId(new URL(request.url).searchParams, null);
  const source = sourceId
    ? await prisma.ldapSource.findFirst({ where: { id: sourceId, deletedAt: null } })
    : await getFirstLdapSource();
  if (!source || !source.enabled) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "LDAP not configured" } },
      { status: 400 },
    );
  }

  const group = await prisma.ldapSyncGroup.upsert({
    where: { dn },
    create: { dn, name, source: "ldap", sourceId: source.id },
    update: { name, deletedAt: null, sourceId: source.id },
  });

  const departmentResult = await ensureLdapDepartment({ id: group.id, name: group.name });

  // Pull members + AD-declared manager immediately so the group and its users
  // show up in the Groups/Users sections right away, not on the next sync.
  let syncedUsers: number | null = null;
  const config = sourceToLdapConfig(source);
  syncedUsers = await syncLdapGroup(config, { id: group.id, dn, name: group.name });

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

  return NextResponse.json({
    data: {
      ...group,
      department: departmentResult.department,
      ...(syncedUsers !== null ? { users: syncedUsers } : {}),
    },
  });
}