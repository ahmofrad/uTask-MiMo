import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createChangeRequest, listChangeRequests } from "@/lib/change-requests";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const crCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  scheduleDeltaDays: z.number().int().optional(),
  costImpactMinor: z.number().int().optional(),
  costCurrency: z.string().max(3).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "APPLIED" | null;

  const crs = await listChangeRequests(id, {
    ...(status && { status }),
  });

  return NextResponse.json({ data: crs });
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

  const parsed = crCreateSchema.safeParse(await readJsonBody(request));
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

  const cr = await createChangeRequest(id, project.organizationId, userId, parsed.data);

  return NextResponse.json({ data: cr }, { status: 201 });
}
