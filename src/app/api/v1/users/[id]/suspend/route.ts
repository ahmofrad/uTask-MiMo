import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { suspendUser, restoreUser } from "@/lib/users";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const user = await prisma.user.findUnique({ where: { id: resolvedParams.id } });
  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 },
    );
  }

  const newStatus = user.status === "suspended" ? "active" : "suspended";

  if (newStatus === "suspended") {
    await suspendUser(resolvedParams.id);
  } else {
    await restoreUser(resolvedParams.id);
  }

  await logAudit({ actorUserId: userId, action: newStatus === "suspended" ? "user_suspended" : "user_unsuspended", entityType: "user", entityId: resolvedParams.id, before: user as never });

  return NextResponse.json({
    data: { id: user.id, status: newStatus },
  });
}