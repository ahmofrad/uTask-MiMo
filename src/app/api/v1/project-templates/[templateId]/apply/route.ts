import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canCreateProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/validation/api";
import { z } from "zod";
import { createProject } from "@/lib/projects";

const applyTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  departmentId: z.string().uuid().nullable().optional(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  if (!(await can(userId, "project:create", organizationId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const template = await prisma.projectTemplate.findFirst({
    where: { id: resolvedParams.templateId, organizationId },
  });

  if (!template) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Template not found" } }, { status: 404 });
  }

  const body = await readJsonBody(request);
  const parsed = applyTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const { name, departmentId } = parsed.data;

  if (!(await canCreateProject(userId, departmentId ?? null, organizationId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not allowed to create a project in this department" } },
      { status: 403 },
    );
  }

  // Create the project
  const project = await createProject({
    name,
    description: null,
    ownerId: userId,
    organizationId,
    departmentId: departmentId ?? null,
    color: template.color,
  });

  // Apply template data
  const templateData = template.templateJson as {
    tasks?: Array<{
      title: string;
      description?: string | null;
      priority?: string;
      estimatedHours?: number | null;
      isMilestone?: boolean;
    }>;
    customFields?: Array<{
      name: string;
      key: string;
      type: string;
      required?: boolean;
      configJson?: Record<string, unknown> | null;
    }>;
  };

  // Create custom fields first
  if (templateData.customFields && templateData.customFields.length > 0) {
    for (const field of templateData.customFields) {
      const createdField = await prisma.customField.create({
        data: {
          projectId: project.id,
          name: field.name,
          key: field.key,
          type: field.type as never,
          required: field.required ?? false,
          configJson: (field.configJson ?? undefined) as never,
        },
      });
      await logAudit({
        organizationId,
        actorUserId: userId,
        action: "custom_field_created",
        entityType: "customField",
        entityId: createdField.id,
        after: createdField as never,
      });
    }
  }

  // Create tasks
  if (templateData.tasks && templateData.tasks.length > 0) {
    for (let i = 0; i < templateData.tasks.length; i++) {
      const taskData = templateData.tasks[i];
      if (!taskData) continue;
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: taskData.title,
          description: taskData.description ?? null,
          status: "open",
          priority: (taskData.priority as never) ?? "med",
          estimatedHours: taskData.estimatedHours ?? null,
          isMilestone: taskData.isMilestone ?? false,
          reporterId: userId,
          createdById: userId,
          orderIndex: (i + 1) * 1000,
        },
      });

      await logAudit({
        organizationId,
        actorUserId: userId,
        action: "task_created",
        entityType: "task",
        entityId: task.id,
        after: task as never,
      });

      // Notify the creator
      const { ensureWatcher } = await import("@/lib/watchers");
      await ensureWatcher(task.id, userId);
    }
  }

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "project_created",
    entityType: "project",
    entityId: project.id,
    after: { projectId: project.id, projectName: project.name, templateId: template.id, templateName: template.name } as never,
  });

  return NextResponse.json({ data: project }, { status: 201 });
}
