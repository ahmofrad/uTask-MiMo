import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "org:settings"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_from", "smtp_secure"];
  const settings = await prisma.settings.findMany({
    where: { scope: "org", scopeId: "smtp", key: { in: keys } },
  });

  const map: Record<string, unknown> = {};
  for (const s of settings) {
    map[s.key] = s.valueJson;
  }

  return NextResponse.json({ data: map });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "org:settings"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  for (const [key, value] of Object.entries(body)) {
    if (!["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "smtp_secure"].includes(key)) continue;
    await prisma.settings.upsert({
      where: { scope_scopeId_key: { scope: "org", scopeId: "smtp", key } },
      update: { valueJson: value as never },
      create: { scope: "org", scopeId: "smtp", key, valueJson: value as never },
    });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "settings",
    entityId: "smtp",
    after: body,
  });

  return NextResponse.json({ data: { success: true } });
}
