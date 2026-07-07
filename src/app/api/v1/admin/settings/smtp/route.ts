import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { getSettings, updateSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "org:settings"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const allSettings = await getSettings("install", null);
  const smtp = (allSettings.smtp ?? {}) as Record<string, unknown>;

  // Return individual keys for the UI
  const map: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(smtp)) {
    map[`smtp_${k}`] = v;
  }

  return NextResponse.json({ data: map });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "org:settings"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const allowedKeys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "smtp_secure"];
  const smtpData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue;
    // Strip "smtp_" prefix to store under the smtp JSON blob
    const shortKey = key.startsWith("smtp_") ? key.slice(5) : key;
    smtpData[shortKey] = value;
  }

  if (Object.keys(smtpData).length > 0) {
    await updateSettings("install", null, { smtp: smtpData });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "settings",
    entityId: "smtp",
    after: body,
  });

  const { resetCache } = await import("@/lib/mail/send");
  resetCache();

  return NextResponse.json({ data: { success: true } });
}
