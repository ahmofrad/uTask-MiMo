import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import type {
  AutomationTrigger,
  AutomationConditionOp,
  AutomationActionType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ── Types ──

export type AutomationRuleData = {
  id: string;
  projectId: string | null;
  teamId: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  conditions: AutomationConditionData[];
  actions: AutomationActionData[];
};

export type AutomationConditionData = {
  id: string;
  ruleId: string;
  field: string;
  op: AutomationConditionOp;
  value: string;
};

export type AutomationActionData = {
  id: string;
  ruleId: string;
  type: AutomationActionType;
  params: unknown;
};

export type TaskSnapshot = {
  id: string;
  status: string;
  priority: string;
  title: string;
  projectId: string;
  dueDate: Date | null;
  assigneeIds: string[];
};

// ── Create rule ──

export async function createRule(
  teamId: string,
  userId: string,
  data: {
    projectId?: string | undefined;
    name: string;
    description?: string | undefined;
    trigger: AutomationTrigger;
    conditions: { field: string; op: AutomationConditionOp; value: string }[];
    actions: { type: AutomationActionType; params: Record<string, unknown> }[];
  },
): Promise<AutomationRuleData> {
  const rule = await prisma.automationRule.create({
    data: {
      teamId,
      projectId: data.projectId ?? null,
      name: data.name,
      description: data.description ?? null,
      trigger: data.trigger,
      createdBy: userId,
      conditions: {
        create: data.conditions.map((c) => ({
          field: c.field,
          op: c.op,
          value: c.value,
        })),
      },
      actions: {
        create: data.actions.map((a) => ({
          type: a.type,
          params: a.params as Prisma.InputJsonValue,
        })),
      },
    },
    include: { conditions: true, actions: true },
  });

  await logAudit({
    actorUserId: userId,
    action: "automation_rule_created",
    entityType: "automation_rule",
    entityId: rule.id,
    after: { teamId, name: data.name, trigger: data.trigger, conditionCount: data.conditions.length, actionCount: data.actions.length },
  });

  return rule as unknown as AutomationRuleData;
}

// ── Update rule ──

export async function updateRule(
  ruleId: string,
  userId: string,
  data: {
    name?: string | undefined;
    description?: string | undefined;
    enabled?: boolean | undefined;
    conditions?: { field: string; op: AutomationConditionOp; value: string }[] | undefined;
    actions?: { type: AutomationActionType; params: Record<string, unknown> }[] | undefined;
  },
): Promise<AutomationRuleData> {
  const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new Error("RULE_NOT_FOUND");

  // Replace conditions/actions if provided
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.enabled !== undefined) updates.enabled = data.enabled;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.conditions) {
      await tx.automationCondition.deleteMany({ where: { ruleId } });
      await tx.automationCondition.createMany({
        data: data.conditions.map((c) => ({ ruleId, field: c.field, op: c.op, value: c.value })),
      });
    }
    if (data.actions) {
      await tx.automationAction.deleteMany({ where: { ruleId } });
      await tx.automationAction.createMany({
        data: data.actions.map((a) => ({ ruleId, type: a.type, params: a.params as Prisma.InputJsonValue })),
      });
    }
    return tx.automationRule.update({
      where: { id: ruleId },
      data: updates,
      include: { conditions: true, actions: true },
    });
  });

  await logAudit({
    actorUserId: userId,
    action: "automation_rule_updated",
    entityType: "automation_rule",
    entityId: ruleId,
  });

  return updated as unknown as AutomationRuleData;
}

// ── List rules ──

export async function listRules(
  projectId: string | null,
  teamId: string,
): Promise<AutomationRuleData[]> {
  const rules = await prisma.automationRule.findMany({
    where: {
      teamId,
      deletedAt: null,
      ...(projectId !== null ? { projectId } : { projectId: null }),
    },
    include: { conditions: true, actions: true },
    orderBy: { createdAt: "desc" },
  });

  return rules as unknown as AutomationRuleData[];
}

// ── Delete rule ──

export async function deleteRule(ruleId: string, userId: string): Promise<void> {
  const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new Error("RULE_NOT_FOUND");

  await prisma.automationRule.update({
    where: { id: ruleId },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "automation_rule_deleted",
    entityType: "automation_rule",
    entityId: ruleId,
  });
}

// ── Condition evaluation ──

function evaluateCondition(condition: AutomationConditionData, task: TaskSnapshot): boolean {
  let fieldValue: string | number;

  switch (condition.field) {
    case "status":
      fieldValue = task.status;
      break;
    case "priority":
      fieldValue = task.priority;
      break;
    case "title":
      fieldValue = task.title;
      break;
    default:
      return false;
  }

  const target = condition.value;

  switch (condition.op) {
    case "EQUALS":
      return String(fieldValue) === target;
    case "NOT_EQUALS":
      return String(fieldValue) !== target;
    case "CONTAINS":
      return String(fieldValue).toLowerCase().includes(target.toLowerCase());
    case "GREATER_THAN":
      return Number(fieldValue) > Number(target);
    case "LESS_THAN":
      return Number(fieldValue) < Number(target);
    case "IS_ONE_OF":
      return target.split(",").map((s) => s.trim()).includes(String(fieldValue));
    default:
      return false;
  }
}

// ── Action execution ──

const MAX_DEPTH = 5;

export async function evaluateAndRun(
  task: TaskSnapshot,
  trigger: AutomationTrigger,
  depth: number = 0,
): Promise<{ ruleId: string; actionsExecuted: number }[]> {
  if (depth >= MAX_DEPTH) return [];

  // Find matching rules
  const rules = await prisma.automationRule.findMany({
    where: {
      enabled: true,
      deletedAt: null,
      OR: [
        { projectId: task.projectId },
        { projectId: null },
      ],
    },
    include: { conditions: true, actions: true },
  });

  const results: { ruleId: string; actionsExecuted: number }[] = [];

  for (const rule of rules) {
    // Check loop guard
    const alreadyFired = await prisma.automationTriggerEvent.findUnique({
      where: { ruleId_taskId: { ruleId: rule.id, taskId: task.id } },
    });
    if (alreadyFired) continue;

    // Check trigger type
    if (rule.trigger !== trigger) continue;

    // Check all conditions
    const allConditionsMet = rule.conditions.every((c) => evaluateCondition(c, task));
    if (!allConditionsMet) continue;

    // Record trigger
    await prisma.automationTriggerEvent.create({
      data: { ruleId: rule.id, taskId: task.id },
    });

    // Execute actions
    let actionsExecuted = 0;
    const errors: string[] = [];

    for (const action of rule.actions) {
      try {
        await executeAction(task, action);
        actionsExecuted++;
      } catch (err) {
        errors.push(String(err));
      }
    }

    // Record run
    await prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        taskId: task.id,
        actionsExecuted,
        error: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    await logAudit({
      actorUserId: rule.createdBy,
      action: "automation_rule_ran",
      entityType: "automation_rule",
      entityId: rule.id,
      after: { taskId: task.id, actionsExecuted, error: errors.length > 0 ? errors.join("; ") : null },
    });

    results.push({ ruleId: rule.id, actionsExecuted });
  }

  return results;
}

async function executeAction(
  task: TaskSnapshot,
  action: AutomationActionData,
): Promise<void> {
  const params = action.params as { value?: string; customFieldKey?: string };

  switch (action.type) {
    case "SET_STATUS":
      if (params.value) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: params.value as "open" | "in_progress" | "done" | "cancelled" },
        });
      }
      break;
    case "SET_PRIORITY":
      if (params.value) {
        await prisma.task.update({
          where: { id: task.id },
          data: { priority: params.value as "low" | "med" | "high" | "urgent" },
        });
      }
      break;
    case "ADD_COMMENT":
      if (params.value) {
        await prisma.comment.create({
          data: {
            taskId: task.id,
            authorId: task.assigneeIds[0] ?? task.id,
            bodyMarkdown: params.value,
          },
        });
      }
      break;
    case "ADD_ASSIGNEE":
      // Implementation depends on existing assignee model
      break;
    case "SET_LABEL":
      // Implementation depends on existing tag model
      break;
    case "SET_CUSTOM_FIELD":
      // Implementation depends on existing custom field model
      break;
  }
}
