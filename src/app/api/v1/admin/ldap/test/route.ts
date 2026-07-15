import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { normalizeLdapConfig, testLdapConnection } from "@/lib/auth/providers/ldap";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json().catch(() => ({}));
  const ldap = (body as { ldap?: Record<string, unknown> }).ldap;
  if (!ldap || typeof ldap !== "object") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "ldap config required" } },
      { status: 400 },
    );
  }

  try {
    const config = normalizeLdapConfig(ldap);
    const result = await testLdapConnection(config);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid LDAP config";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message } },
      { status: 400 },
    );
  }
}