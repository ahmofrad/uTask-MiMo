import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { validateWebhookUrl } from "@/lib/webhook";
import { randomHex } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });

  return NextResponse.json({ data: webhooks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, url, events } = body as { name?: string; url?: string; events?: string[] };

  if (!name || !url || !events || !Array.isArray(events)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "name, url, and events required" } }, { status: 400 });
  }

  if (!validateWebhookUrl(url)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook URL: must be HTTPS and must not point to a private/internal network" } }, { status: 400 });
  }

  const secret = randomHex(32);

  const webhook = await prisma.webhook.create({
    data: {
      name,
      url,
      secret,
      events,
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "webhook_created",
    entityType: "webhook",
    entityId: webhook.id,
    after: { name, url, events },
  });

  return NextResponse.json({ data: { ...webhook, secret } }, { status: 201 });
}
