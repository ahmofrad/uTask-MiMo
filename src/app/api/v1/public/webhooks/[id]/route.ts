import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { validateWebhookUrlResolved } from "@/lib/webhook";
import { publicWebhookUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;
  if (!(await can(userId, "webhook:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const parsed = publicWebhookUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const { name, url, events, active } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (url !== undefined) {
    if (!await validateWebhookUrlResolved(String(url))) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid webhook URL: must be HTTPS and must not point to a private/internal network",
          },
        },
        { status: 400 },
      );
    }
    updateData.url = url;
  }
  if (events !== undefined) updateData.events = events;
  if (active !== undefined) updateData.active = active;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "At least one field is required" } }, { status: 400 });
  }

  const before = await prisma.webhook.findFirst({ where: { id: resolvedParams.id, deletedAt: null } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  const webhook = await prisma.webhook.update({
    where: { id: resolvedParams.id },
    data: updateData,
  });

  const { secret: _beforeSecret, ...beforeAudit } = before;
  const { secret: _afterSecret, ...afterAudit } = webhook;
  void _beforeSecret;
  void _afterSecret;
  await logAudit({
    actorUserId: userId,
    action: "webhook_updated",
    entityType: "webhook",
    entityId: resolvedParams.id,
    before: beforeAudit as never,
    after: afterAudit as never,
  });

  const { secret: _secret, ...safeWebhook } = webhook;
  void _secret;
  return NextResponse.json({ data: safeWebhook });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(_request, "webhooks:manage");
  if (error) return error;
  if (!(await can(userId, "webhook:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const before = await prisma.webhook.findFirst({ where: { id: resolvedParams.id, deletedAt: null } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  await prisma.webhook.update({
    where: { id: resolvedParams.id },
    data: { deletedAt: new Date() },
  });

  const { secret: _secret, ...beforeAudit } = before;
  void _secret;
  await logAudit({
    actorUserId: userId,
    action: "webhook_deleted",
    entityType: "webhook",
    entityId: resolvedParams.id,
    before: beforeAudit as never,
  });

  return NextResponse.json({ data: { success: true } });
}
