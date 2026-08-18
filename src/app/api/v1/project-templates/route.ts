import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/validation/api";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  color: z.string().trim().min(1).max(64).optional(),
  templateJson: z.object({
    tasks: z.array(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(100000).nullable().optional(),
      priority: z.enum(["low", "med", "high", "urgent"]).optional(),
      estimatedHours: z.number().min(0).max(100000).nullable().optional(),
      isMilestone: z.boolean().optional(),
    })),
    customFields: z.array(z.object({
      name: z.string().min(1).max(255),
      key: z.string().min(1).max(255),
      type: z.enum(["text", "number", "date", "select", "multi_select", "user", "checkbox", "url"]),
      required: z.boolean().optional(),
      configJson: z.record(z.string(), z.unknown()).nullable().optional(),
    })).optional(),
  }),
}).strict();

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const templates = await prisma.projectTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await can(userId, "project:create"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await readJsonBody(request);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const { name, description, color, templateJson } = parsed.data;

  const template = await prisma.projectTemplate.create({
    data: {
      name,
      description: description ?? null,
      color: color ?? "#2563eb",
      templateJson: templateJson as never,
      createdById: userId,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "project_created",
    entityType: "projectTemplate",
    entityId: template.id,
    after: template as never,
  });

  return NextResponse.json({ data: template }, { status: 201 });
}
