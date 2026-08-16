import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { syncLdapSource } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { id } = await params;
  try {
    const result = await syncLdapSource(id);
    await logAudit({
      actorUserId: userId,
      action: "ldap_sync",
      entityType: "ldapsource",
      entityId: id,
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
