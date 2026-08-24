import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createRisk, listRisks } from "@/lib/risks";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const riskCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  response: z.enum(["MITIGATE", "ACCEPT", "TRANSFER", "AVOID"]).optional(),
  mitigationPlan: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "OPEN" | "MONITORING" | "CLOSED" | null;
  const minScore = url.searchParams.get("minScore");

  const risks = await listRisks(id, {
    ...(status && { status }),
    ...(minScore ? { minScore: parseInt(minScore, 10) } : {}),
  });

  return NextResponse.json({ data: risks });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const parsed = riskCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 },
    );
  }

  const risk = await createRisk(id, project.organizationId, userId, parsed.data);

  return NextResponse.json({ data: risk }, { status: 201 });
}
