import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { suspendUser, restoreUser } from "@/lib/users";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 },
    );
  }

  const newStatus = user.status === "suspended" ? "active" : "suspended";

  if (newStatus === "suspended") {
    await suspendUser(params.id);
  } else {
    await restoreUser(params.id);
  }

  await logAudit({ actorUserId: userId, action: newStatus === "suspended" ? "user_suspended" : "user_unsuspended", entityType: "user", entityId: params.id, before: user as never });

  return NextResponse.json({
    data: { id: user.id, status: newStatus },
  });
}