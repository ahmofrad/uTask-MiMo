import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const map = await getSettings("user", session.user.id);

  return NextResponse.json({ data: map });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const permitted = await can(session.user.id, "settings:update");
  if (!permitted) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const body = await request.json() as Record<string, unknown>;

  await updateSettings("user", session.user.id, body);

  await logAudit({ actorUserId: session.user.id, action: "settings_updated", entityType: "settings", entityId: session.user.id, after: body as never });

  return NextResponse.json({ data: { success: true } });
}
