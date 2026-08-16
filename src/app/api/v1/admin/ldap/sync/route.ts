import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { getEnabledLdapSources } from "@/lib/auth/ldap-sources";
import { syncLdapSource, syncAllLdapSources } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody } from "@/lib/validation/api";

function parseSourceId(body: unknown): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const candidate = (body as { sourceId?: unknown }).sourceId;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const sourceId = parseSourceId(await readJsonBody(request));
  if (sourceId) {
    const source = await prisma.ldapSource.findFirst({
      where: { id: sourceId, deletedAt: null },
      select: { id: true, enabled: true },
    });
    if (!source) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "LDAP source not found" } }, { status: 404 });
    }
    if (!source.enabled) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "LDAP source is disabled" } }, { status: 400 });
    }

    const result = await syncLdapSource(source.id);
    await logAudit({
      actorUserId: userId,
      action: "ldap_sync",
      entityType: "ldapsource",
      entityId: source.id,
      after: result,
    });
    return NextResponse.json({ data: result });
  }

  const sources = await getEnabledLdapSources();
  if (sources.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "LDAP not configured" } },
      { status: 400 },
    );
  }

  const result = await syncAllLdapSources();

  await logAudit({
    actorUserId: userId,
    action: "ldap_sync",
    entityType: "ldapsource",
    entityId: "all",
    after: result,
  });

  return NextResponse.json({ data: result });
}