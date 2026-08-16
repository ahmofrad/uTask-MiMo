import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canManageGroup } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { addGroupMember, listGroupMembers } from "@/lib/groups";
import { checkIdempotency, setIdempotencyResult, acquirePending, releasePending, type IdempotencyScope } from "@/lib/idempotency";
import { sha256 } from "@/lib/crypto";
import { groupMemberAddSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canManageGroup(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }
  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  const members = await listGroupMembers(group.id);
  return NextResponse.json({ data: members });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canManageGroup(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }
  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  const parsed = groupMemberAddSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { userId: memberUserId } = parsed.data;

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } }, { status: 400 });
  }
  const idempotencyScope: IdempotencyScope = {
    userId,
    route: `groups:${group.id}:members:add`,
    bodyHash: sha256(JSON.stringify(parsed.data)),
  };
  const cached = await checkIdempotency(idempotencyKey, idempotencyScope);
  if (cached.unavailable) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (cached.conflict) {
    return NextResponse.json(
      { error: { code: "IDEMPOTENCY_KEY_REUSE", message: "Idempotency-Key was already used with a different request body" } },
      { status: 409 },
    );
  }
  if (cached.hit) {
    return NextResponse.json(cached.response.body, { status: cached.response.status });
  }
  const pending = await acquirePending(idempotencyKey, idempotencyScope);
  if (pending === "unavailable") {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (pending !== "acquired") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Request already in progress" } },
      { status: 409 },
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: memberUserId },
      select: { id: true, status: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
    }

    const { membership, created } = await addGroupMember(group.id, memberUserId);

    if (created) {
      await logAudit({
        actorUserId: userId,
        action: "group_member_added",
        entityType: "group",
        entityId: group.id,
        after: { userId: memberUserId },
      });
    }

    // Re-adding an existing member is idempotent: 200 + alreadyMember flag so
    // the UI never double-adds a row or inflates the member count.
    const responseBody = { data: membership, ...(created ? {} : { alreadyMember: true }) };
    const status = created ? 201 : 200;
    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, status, responseBody, idempotencyScope);
    }

    return NextResponse.json(responseBody, { status });
  } finally {
    if (idempotencyKey) await releasePending(idempotencyKey, idempotencyScope);
  }
}
