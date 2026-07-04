import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { projectId, taskIds } = body as { projectId?: string; taskIds?: string[] };

  if (!projectId || !taskIds || !Array.isArray(taskIds) || taskIds.length < 2) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId and taskIds array (min 2) required" } },
      { status: 400 },
    );
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, projectId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, orderIndex: true },
  });

  const updates = tasks.map((task, i) =>
    prisma.task.update({
      where: { id: task.id },
      data: { orderIndex: (i + 1) * 1000 },
    }),
  );

  await prisma.$transaction(updates);

  await logAudit({ actorUserId: session.user.id, action: "task_reordered", entityType: "task", entityId: projectId, after: { projectId, taskIds } as never });

  return NextResponse.json({ data: { success: true } });
}
