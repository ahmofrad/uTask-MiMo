import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, isProjectOwner } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, validationError } from "@/lib/validation/api";

const healthSchema = z
  .object({
    ragStatus: z.enum(["GREEN", "AMBER", "RED"]),
    ragReason: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

/**
 * Sets a project's curated RAG health (G15c). The status is set manually by
 * project WRITE holders, not derived — the reason is free text shown next to
 * the badge. Every change is audited.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const projectDelegate = prisma.project as typeof prisma.project & { findFirst?: typeof prisma.project.findFirst };
  const project = await (projectDelegate.findFirst ?? prisma.project.findUnique)({
    where: { id: resolvedParams.projectId, ...(organizationId ? { organizationId } : {}) },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const permitted =
    (await canProject(userId, "project:update", resolvedParams.projectId, organizationId)) ||
    (await isProjectOwner(userId, resolvedParams.projectId, organizationId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = healthSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: resolvedParams.projectId },
    data: {
      ragStatus: parsed.data.ragStatus,
      ragReason: parsed.data.ragReason ?? null,
      healthUpdatedAt: new Date(),
    },
  });

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "project_health_updated",
    entityType: "project",
    entityId: resolvedParams.projectId,
    before: { ragStatus: project.ragStatus, ragReason: project.ragReason ?? null },
    after: { ragStatus: updated.ragStatus, ragReason: updated.ragReason ?? null },
  });

  return NextResponse.json({
    data: {
      ragStatus: updated.ragStatus,
      ragReason: updated.ragReason,
      healthUpdatedAt: updated.healthUpdatedAt,
    },
  });
}
