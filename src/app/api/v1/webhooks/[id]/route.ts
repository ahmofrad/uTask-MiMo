import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { validateWebhookUrl } from "@/lib/webhook";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, url, events, active } = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (url !== undefined) {
    if (!validateWebhookUrl(String(url))) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook URL: must be HTTPS and must not point to a private/internal network" } }, { status: 400 });
    }
    updateData.url = url;
  }
  if (events !== undefined) updateData.events = events;
  if (active !== undefined) updateData.active = active;

  const webhook = await prisma.webhook.update({
    where: { id: params.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "webhook_updated",
    entityType: "webhook",
    entityId: params.id,
    before: { name, url, events, active },
    after: updateData,
  });

  return NextResponse.json({ data: webhook });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await prisma.webhook.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "webhook_deleted",
    entityType: "webhook",
    entityId: params.id,
  });

  return NextResponse.json({ data: { success: true } });
}
