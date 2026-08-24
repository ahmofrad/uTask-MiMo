import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { updateRule, deleteRule } from "@/lib/automation";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const ruleUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(z.object({
    field: z.string().min(1).max(100),
    op: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN", "IS_ONE_OF"]),
    value: z.string().min(1).max(500),
  })).optional(),
  actions: z.array(z.object({
    type: z.enum(["SET_STATUS", "SET_PRIORITY", "ADD_ASSIGNEE", "ADD_COMMENT", "SET_LABEL", "SET_CUSTOM_FIELD"]),
    params: z.record(z.string(), z.unknown()),
  })).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await params;
  const authResult = await requireAuth(request, { params: { ruleId } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = ruleUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  try {
    const rule = await updateRule(ruleId, userId, parsed.data);
    return NextResponse.json({ data: rule });
  } catch (err) {
    if (String(err) === "Error: RULE_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule not found" } },
        { status: 404 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await params;
  const authResult = await requireAuth(request, { params: { ruleId } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    await deleteRule(ruleId, userId);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (String(err) === "Error: RULE_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Rule not found" } },
        { status: 404 },
      );
    }
    throw err;
  }
}
