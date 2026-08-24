import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { transitionChangeRequest, deleteChangeRequest } from "@/lib/change-requests";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const transitionSchema = z.object({
  status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "APPLIED"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; crId: string }> },
) {
  const { id, crId } = await params;
  const authResult = await requireAuth(request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const parsed = transitionSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  try {
    const cr = await transitionChangeRequest(crId, id, userId, parsed.data.status);
    return NextResponse.json({ data: cr });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("CR_NOT_FOUND")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Change request not found" } },
        { status: 404 },
      );
    }
    if (msg.includes("INVALID_TRANSITION")) {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: "Invalid status transition" } },
        { status: 422 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; crId: string }> },
) {
  const { id, crId } = await params;
  const authResult = await requireAuth(request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  try {
    await deleteChangeRequest(crId, id, userId);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("CR_NOT_FOUND")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Change request not found" } },
        { status: 404 },
      );
    }
    if (msg.includes("CR_NOT_DELETABLE")) {
      return NextResponse.json(
        { error: { code: "NOT_DELETABLE", message: "Only draft CRs can be deleted" } },
        { status: 422 },
      );
    }
    throw err;
  }
}
