import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { validateWebhookUrlResolved } from "@/lib/webhook";
import { publicWebhookUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const parsed = publicWebhookUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, url, events, active } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (url !== undefined) {
    if (!await validateWebhookUrlResolved(String(url))) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook URL: must be HTTPS and must not point to a private/internal network" } }, { status: 400 });
    }
    updateData.url = url;
  }
  if (events !== undefined) updateData.events = events;
  if (active !== undefined) updateData.active = active;

  const webhook = await prisma.webhook.update({
    where: { id: resolvedParams.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: userId,
    action: "webhook_updated",
    entityType: "webhook",
    entityId: resolvedParams.id,
    before: { name, url, events, active },
    after: updateData,
  });

  return NextResponse.json({ data: webhook });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  await prisma.webhook.update({
    where: { id: resolvedParams.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "webhook_deleted",
    entityType: "webhook",
    entityId: resolvedParams.id,
  });

  return NextResponse.json({ data: { success: true } });
}