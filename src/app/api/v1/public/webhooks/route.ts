import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { randomHex } from "@/lib/crypto";
import { encrypt } from "@/lib/crypto/encrypt";
import { validateWebhookUrlResolved } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";
import { publicWebhookCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { userId, rateLimit, error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;
  if (!(await can(userId, "webhook:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const webhooks = await prisma.webhook.findMany({
    where: { deletedAt: null },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

  return withPublicApiRateLimit(NextResponse.json({
    data: webhooks,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  }), rateLimit);
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;
  if (!(await can(userId, "webhook:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const parsed = publicWebhookCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const { name, url, events } = parsed.data;

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
