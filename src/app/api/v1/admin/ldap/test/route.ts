import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { normalizeLdapConfig, testLdapConnection } from "@/lib/auth/providers/ldap";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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
