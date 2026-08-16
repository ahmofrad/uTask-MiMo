import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { syncLdapSource } from "@/lib/auth/providers/ldap";
import { getLdapSource, redactLdapSource } from "@/lib/auth/ldap-sources";
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

  try {
    const before = redactLdapSource(source);
    const result = await syncLdapSource(id);
    await logAudit({
      actorUserId: userId,
      action: "ldap_sync",
      entityType: "ldapsource",
      entityId: id,
      before,
      after: result,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json(
      { error: { code: "SYNC_FAILED", message } },
      { status: 500 },
    );
  }
}
