import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { deleteAttachment } from "@/lib/attachments";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  try {
    await deleteAttachment(resolvedParams.attachmentId, resolvedParams.id, userId);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Attachment not found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}