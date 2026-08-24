import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { captureBaseline } from "@/lib/baselines";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const baselineCreateSchema = z.object({
  name: z.string().min(1).max(200),
  source: z.enum(["MANUAL", "CHANGE_REQUEST"]).optional().default("MANUAL"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(_request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;

  const baselines = await prisma.projectBaseline.findMany({
    where: { projectId: id },
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      name: true,
      source: true,
      isCurrent: true,
      capturedBy: true,
      capturedAt: true,
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({
    data: baselines.map((b) => ({
      ...b,
      entryCount: b._count.entries,
    })),
  });
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

  const parsed = baselineCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const baseline = await captureBaseline(id, parsed.data.name, userId, parsed.data.source);

  return NextResponse.json({ data: baseline }, { status: 201 });
}
