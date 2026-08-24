import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { createRule, listRules } from "@/lib/automation";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const ruleCreateSchema = z.object({
  projectId: z.string().uuid().optional(),
  teamId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  trigger: z.enum([
    "STATUS_CHANGED",
    "PRIORITY_CHANGED",
    "ASSIGNMENT_ADDED",
    "COMMENT_ADDED",
    "DUE_DATE_APPROACHING",
    "DUE_DATE_PASSED",
    "TASK_CREATED",
  ]),
  conditions: z.array(z.object({
    field: z.string().min(1).max(100),
    op: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN", "IS_ONE_OF"]),
    value: z.string().min(1).max(500),
  })).min(1),
  actions: z.array(z.object({
    type: z.enum(["SET_STATUS", "SET_PRIORITY", "ADD_ASSIGNEE", "ADD_COMMENT", "SET_LABEL", "SET_CUSTOM_FIELD"]),
    params: z.record(z.string(), z.unknown()),
  })).min(1),
});

export async function GET(
  request: Request,
) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const projectId = url.searchParams.get("projectId");

  if (!teamId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "teamId is required" } },
      { status: 400 },
    );
  }

  const rules = await listRules(projectId, teamId);
  return NextResponse.json({ data: rules });
}

export async function POST(
  request: Request,
) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = ruleCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const rule = await createRule(parsed.data.teamId, userId, {
    projectId: parsed.data.projectId,
    name: parsed.data.name,
    description: parsed.data.description,
    trigger: parsed.data.trigger,
    conditions: parsed.data.conditions,
    actions: parsed.data.actions,
  });

  return NextResponse.json({ data: rule }, { status: 201 });
}
