import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; subtaskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body as { status?: string };

  if (!status) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "status is required" } },
      { status: 400 },
    );
  }

  const before = await prisma.task.findUnique({ where: { id: params.subtaskId } });

  const subtask = await prisma.task.update({
    where: { id: params.subtaskId, parentTaskId: params.id },
    data: {
      status: status as "open" | "in_progress" | "done" | "cancelled",
      ...(status === "done" ? { completedAt: new Date() } : {}),
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "task",
    entityId: subtask.id,
    before,
    after: subtask,
  });

  return NextResponse.json({ data: subtask });
}
