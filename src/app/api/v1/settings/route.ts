import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getSettings, updateSettings } from "@/lib/settings";
import { readJsonBody } from "@/lib/validation/api";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const map = await getSettings("user", userId);

  return NextResponse.json({ data: map });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("settings:update");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Settings must be an object" } }, { status: 400 });
  }
  const updates = body as Record<string, unknown>;

  await updateSettings("user", userId, updates);

  await logAudit({ actorUserId: userId, action: "settings_updated", entityType: "settings", entityId: userId, after: updates as never });

  return NextResponse.json({ data: { success: true } });
}