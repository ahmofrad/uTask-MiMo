import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const settings = await prisma.settings.findMany({
    where: { scope: "user", scopeId: session.user.id },
  });

  const map: Record<string, unknown> = {};
  for (const s of settings) {
    map[s.key] = s.valueJson;
  }

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

  for (const [key, value] of Object.entries(body)) {
    await prisma.settings.upsert({
      where: { scope_scopeId_key: { scope: "user", scopeId: session.user.id, key } },
      update: { valueJson: value as never },
      create: { scope: "user", scopeId: session.user.id, key, valueJson: value as never },
    });
  }

  await logAudit({ actorUserId: session.user.id, action: "settings_updated", entityType: "settings", entityId: session.user.id, after: body as never });

  return NextResponse.json({ data: { success: true } });
}
