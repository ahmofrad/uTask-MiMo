import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { suspendUser, restoreUser } from "@/lib/users";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

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

  await logAudit({ actorUserId: session.user.id, action: newStatus === "suspended" ? "user_suspended" : "user_unsuspended", entityType: "user", entityId: params.id, before: user as never });

  return NextResponse.json({
    data: { id: user.id, status: newStatus },
  });
}
