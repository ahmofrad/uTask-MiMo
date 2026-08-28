import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";
import type { AutomationTrigger, AutomationConditionOp, AutomationActionType } from "@prisma/client";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let teamId = "";
let userId = "";
let taskId = "";

maybe("automation evaluateAndRun (integration)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `auto-member-${Date.now()}@example.com`,
        displayName: "Automation Member",
        status: "active",
      },
    });
    userId = user.id;

    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId } },
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId, role: "member" },
      update: {},
    });

    const project = await prisma.project.create({
      data: {
        name: `auto-it-${Date.now()}`,
        ownerId: userId,
        visibility: "org",
      },
    });
    projectId = project.id;
    teamId = project.id; // Use project ID as teamId

    const task = await prisma.task.create({
      data: {
        projectId,
        title: "Automation target task",
        status: "open",
        priority: "med",
        createdById: userId,
        reporterId: userId,
        assignees: { create: [{ userId }] },
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    if (taskId) await prisma.task.deleteMany({ where: { projectId } });
    if (projectId) {
      await prisma.automationRule.deleteMany({ where: { teamId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (userId) {
      await prisma.organizationMembership.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("fires SET_STATUS action when status condition matches", async () => {
    const { evaluateAndRun } = await import("@/lib/automation");

    // Create a rule: when status changes to "in_progress", set priority to "urgent".
    const rule = await prisma.automationRule.create({
      data: {
        teamId,
        projectId,
        name: "Auto-escalate",
        trigger: "STATUS_CHANGED",
        createdBy: userId,
        conditions: {
          create: [{ field: "status", op: "EQUALS" as AutomationConditionOp, value: "in_progress" }],
        },
        actions: {
          create: [{ type: "SET_PRIORITY" as AutomationActionType, params: { value: "urgent" } }],
        },
      },
      include: { conditions: true, actions: true },
    });

    const taskSnap = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    const results = await evaluateAndRun(
      {
        id: taskId,
        status: "in_progress",
        priority: "med",
        title: taskSnap.title,
        projectId,
        dueDate: taskSnap.dueDate,
        assigneeIds: [userId],
      },
      "STATUS_CHANGED",
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.ruleId).toBe(rule.id);
    expect(results[0]!.actionsExecuted).toBe(1);

    // Verify the task priority was actually updated.
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(updated.priority).toBe("urgent");

    // Reset.
    await prisma.task.update({ where: { id: taskId }, data: { priority: "med" } });
  });

  it("does not fire when conditions do not match", async () => {
    const { evaluateAndRun } = await import("@/lib/automation");

    // Create a rule: when priority is "urgent", set status to "cancelled".
    await prisma.automationRule.create({
      data: {
        teamId,
        projectId,
        name: "Cancel urgent",
        trigger: "STATUS_CHANGED",
        createdBy: userId,
        conditions: {
          create: [{ field: "priority", op: "EQUALS" as AutomationConditionOp, value: "urgent" }],
        },
        actions: {
          create: [{ type: "SET_STATUS" as AutomationActionType, params: { value: "cancelled" } }],
        },
      },
    });

    const taskSnap = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    // Trigger with status "in_progress" but task priority is "med" — condition won't match.
    const results = await evaluateAndRun(
      {
        id: taskId,
        status: "in_progress",
        priority: "med",
        title: taskSnap.title,
        projectId,
        dueDate: taskSnap.dueDate,
        assigneeIds: [userId],
      },
      "STATUS_CHANGED",
    );

    // The priority condition ("priority EQUALS urgent") does not match "med", so no rule fires.
    // But the earlier "status EQUALS in_progress" rule would have fired (if the loop guard hadn't
    // already recorded the trigger). Since this is a new rule with a different condition, it won't
    // match because priority is "med", not "urgent".
    const matchedResults = results.filter((r) => {
      // Check if this rule is the "Cancel urgent" one.
      return true;
    });
    // No rule should fire because the only new rule requires priority=urgent.
    expect(matchedResults.filter((r) => r.actionsExecuted > 0)).toHaveLength(0);

    // Verify task is still open.
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(updated.status).not.toBe("cancelled");
  });

  it("does not re-fire for the same task (loop guard)", async () => {
    const { evaluateAndRun } = await import("@/lib/automation");

    // The first rule ("Auto-escalate") already fired for this task in the first test.
    // Calling evaluateAndRun again with the same trigger should be a no-op.
    const results = await evaluateAndRun(
      {
        id: taskId,
        status: "in_progress",
        priority: "med",
        title: "Automation target task",
        projectId,
        dueDate: null,
        assigneeIds: [userId],
      },
      "STATUS_CHANGED",
    );

    // No rules should fire because the loop guard blocks re-triggering.
    expect(results).toHaveLength(0);
  });

  it("respect MAX_DEPTH guard", async () => {
    const { evaluateAndRun } = await import("@/lib/automation");

    // Passing depth >= MAX_DEPTH should immediately return.
    const results = await evaluateAndRun(
      {
        id: taskId,
        status: "open",
        priority: "med",
        title: "Depth test",
        projectId,
        dueDate: null,
        assigneeIds: [],
      },
      "STATUS_CHANGED",
      10, // Exceeds MAX_DEPTH (5).
    );

    expect(results).toHaveLength(0);
  });
});
