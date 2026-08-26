import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { updateRisk, deleteRisk } from "@/lib/risks";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const riskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  response: z.enum(["MITIGATE", "ACCEPT", "TRANSFER", "AVOID"]).optional(),
  mitigationPlan: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(["OPEN", "MONITORING", "CLOSED"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; riskId: string }> },
) {
  const { projectId, riskId } = await params;
  const authResult = await requireAuth(request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", projectId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const parsed = riskUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  try {
    const risk = await updateRisk(riskId, projectId, userId, parsed.data);
    return NextResponse.json({ data: risk });
  } catch (err) {
    if (String(err) === "Error: RISK_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Risk not found" } },
        { status: 404 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; riskId: string }> },
) {
  const { projectId, riskId } = await params;
  const authResult = await requireAuth(request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", projectId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  try {
    await deleteRisk(riskId, projectId, userId);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (String(err) === "Error: RISK_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Risk not found" } },
        { status: 404 },
      );
    }
    throw err;
  }
}
