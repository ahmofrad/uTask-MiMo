import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";
import { randomHex } from "@/lib/crypto";
import { encrypt } from "@/lib/crypto/encrypt";
import { validateWebhookUrlResolved } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const { error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const webhooks = await prisma.webhook.findMany({
    where: { deletedAt: null },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = webhooks.length > limit;
  if (hasMore) webhooks.pop();
  const lastItem = webhooks[webhooks.length - 1];

  return NextResponse.json({
    data: webhooks,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;

  const body = await request.json();
  const { name, url, events } = body as { name?: string; url?: string; events?: string[] };

  if (!name || !url || !events || !Array.isArray(events)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name, url, and events required" } },
      { status: 400 },
    );
  }

  if (!await validateWebhookUrlResolved(url)) {
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
