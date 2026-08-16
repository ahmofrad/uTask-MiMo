import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { testLdapConnection } from "@/lib/auth/providers/ldap";
import { getLdapSource, redactLdapSource, sourceToLdapConfig } from "@/lib/auth/ldap-sources";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { id } = await params;
  const source = await getLdapSource(id);
  if (!source) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "LDAP source not found" } }, { status: 404 });
  }

  const result = await testLdapConnection(sourceToLdapConfig(source));

  await logAudit({
    actorUserId: userId,
    action: "ldap_source_tested",
    entityType: "ldapsource",
    entityId: id,
    before: redactLdapSource(source),
    after: result as Record<string, unknown>,
  });

  return NextResponse.json({ data: result });
}
