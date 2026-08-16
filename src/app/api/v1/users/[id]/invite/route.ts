import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { issueInvite } from "@/lib/auth/invites";
import { logger } from "@/lib/logging";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, email: true, status: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 },
    );
  }
  if (user.status !== "invited") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Only invited users can be sent an invitation" } },
      { status: 400 },
    );
  }

  try {
    await issueInvite({
      userId: user.id,
      email: user.email,
      request,
      actorUserId: userId,
      requestId: request.headers.get("x-request-id") ?? "",
    });
  } catch (error) {
    // Token + audit are written; a failure here (e.g. delivery) can be retried.
    logger.error({ error, userId: user.id }, "Invite resend failed");
  }

  return NextResponse.json({ data: { success: true } });
}
