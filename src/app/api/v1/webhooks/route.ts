import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { randomHex } from "@/lib/crypto";
import { encrypt } from "@/lib/crypto/encrypt";
import { validateWebhookUrlResolved } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const webhooks = await prisma.webhook.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, events: true, active: true, createdAt: true },
  });

  return NextResponse.json({ data: webhooks });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { name, url, events } = body as { name?: string; url?: string; events?: string[] };

  if (!name || !url || !events || !Array.isArray(events)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name, url, and events required" } },
      { status: 400 },
    );
  }

  if (!await validateWebhookUrlResolved(url)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook URL: must be HTTPS and must not point to a private/internal network" } }, { status: 400 });
  }

  const rawSecret = randomHex(32);
  const { iv, ciphertext, tag } = encrypt(rawSecret);

  const webhook = await prisma.webhook.create({
    data: {
      name,
      url,
      secret: `${iv}:${ciphertext}:${tag}`,
      events,
      createdById: userId,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "webhook_created",
    entityType: "webhook",
    entityId: webhook.id,
    after: { name, url, events },
  });

  return NextResponse.json({ data: { ...webhook, secret: rawSecret } }, { status: 201 });
}