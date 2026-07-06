import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { randomHex } from "@/lib/crypto";
import { encrypt } from "@/lib/crypto/encrypt";
import { validateWebhookUrl } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "webhook:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, events: true, active: true, createdAt: true },
  });

  return NextResponse.json({ data: webhooks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "webhook:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, url, events } = body as { name?: string; url?: string; events?: string[] };

  if (!name || !url || !events || !Array.isArray(events)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name, url, and events required" } },
      { status: 400 },
    );
  }

  if (!validateWebhookUrl(url)) {
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

  return NextResponse.json({ data: { ...webhook, secret: rawSecret } }, { status: 201 });
}
