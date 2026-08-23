import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getUserReadableProjectIds } from "@/lib/projects/queries";
import { problemResponse } from "@/lib/api/problem";

const querySchema = z.object({
  resource: z.enum(["projects", "tasks", "audit"]),
  format: z.enum(["json", "csv"]).default("json"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvResponse(resource: string, rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = [keys.join(","), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))].join("\n");
  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taskapp-${resource}.csv"`,
    },
  });
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await can(authResult.userId, "data:export", authResult.organizationId))) {
    return problemResponse(request, 403, "FORBIDDEN", "You are not allowed to export data");
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid export parameters");
  const { resource, format, cursor, limit } = parsed.data;
  const readable = await getUserReadableProjectIds(authResult.userId, authResult.organizationId);
  const projectScope = readable === null ? {} : { projectId: { in: readable } };

  if (resource === "projects") {
    const rows = await prisma.project.findMany({
      where: { organizationId: authResult.organizationId, archivedAt: null, ...(readable === null ? {} : { id: { in: readable } }) },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, status: true, visibility: true, ownerId: true, departmentId: true, createdAt: true, updatedAt: true },
    });
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const data = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) as Record<string, unknown>[];
    return format === "csv" ? csvResponse(resource, data) : NextResponse.json({ data, meta: { nextCursor: hasMore ? rows.at(-1)?.id ?? null : null, hasMore } });
  }

  if (resource === "tasks") {
    const rows = await prisma.task.findMany({
      where: { ...projectScope, deletedAt: null, project: { organizationId: authResult.organizationId } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, projectId: true, title: true, status: true, priority: true, dueDate: true, estimatedHours: true, spentHours: true, createdAt: true, updatedAt: true },
    });
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const data = rows.map((row) => ({
      ...row,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      estimatedHours: row.estimatedHours?.toNumber() ?? null,
      spentHours: row.spentHours?.toNumber() ?? null,
    })) as Record<string, unknown>[];
    return format === "csv" ? csvResponse(resource, data) : NextResponse.json({ data, meta: { nextCursor: hasMore ? rows.at(-1)?.id ?? null : null, hasMore } });
  }

  const rows = await prisma.auditLog.findMany({
    where: { organizationId: authResult.organizationId },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { id: true, actorUserId: true, action: true, entityType: true, entityId: true, beforeJson: true, afterJson: true, occurredAt: true, requestId: true },
  });
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const data = rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })) as Record<string, unknown>[];
  return format === "csv" ? csvResponse(resource, data) : NextResponse.json({ data, meta: { nextCursor: hasMore ? rows.at(-1)?.id ?? null : null, hasMore } });
}
