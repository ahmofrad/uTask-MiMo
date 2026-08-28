import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let memberId = "";
let approverId = "";
let taskId = "";
let otherTaskId = "";

maybe("task approval flow (integration)", () => {
  beforeAll(async () => {
    // Create two users: one member (task creator) and one approver (task finalizer).
    const member = await prisma.user.create({
      data: {
        email: `approval-member-${Date.now()}@example.com`,
        displayName: "Approval Member",
        status: "active",
      },
    });
    memberId = member.id;

    const approver = await prisma.user.create({
      data: {
        email: `approval-approver-${Date.now()}@example.com`,
        displayName: "Approval Approver",
        status: "active",
      },
    });
    approverId = approver.id;

    // Both users need org membership + roles.
    for (const uid of [memberId, approverId]) {
      await prisma.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: uid } },
        create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: uid, role: "member" },
        update: {},
      });
    }

    // Create a project with the member as contributor and approver as lead.
    const project = await prisma.project.create({
      data: {
        name: `approval-flow-it-${Date.now()}`,
        ownerId: approverId,
        visibility: "org",
        members: {
          create: [
            {
              user: { connect: { id: memberId } },
              addedByUser: { connect: { id: approverId } },
              projectRole: "contributor",
            },
            {
              user: { connect: { id: approverId } },
              addedByUser: { connect: { id: approverId } },
              projectRole: "lead",
            },
          ],
        },
      },
    });
    projectId = project.id;

    // Task that requires approval with the approver designated.
    const task = await prisma.task.create({
      data: {
        projectId,
        title: "Approval gate task",
        description: "Needs approval to complete.",
        status: "in_progress",
        createdById: memberId,
        reporterId: memberId,
        requiresApproval: true,
        approverId,
        assignees: { create: [{ userId: memberId }] },
      },
    });
    taskId = task.id;

    // A second task without approval requirement for comparison.
    const otherTask = await prisma.task.create({
      data: {
        projectId,
        title: "Normal task",
        description: "No approval needed.",
        status: "in_progress",
        createdById: memberId,
        reporterId: memberId,
        requiresApproval: false,
        assignees: { create: [{ userId: memberId }] },
      },
    });
    otherTaskId = otherTask.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.task.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (memberId) {
      await prisma.organizationMembership.deleteMany({ where: { userId: memberId } });
      await prisma.user.deleteMany({ where: { id: memberId } });
    }
    if (approverId) {
      await prisma.organizationMembership.deleteMany({ where: { userId: approverId } });
      await prisma.user.deleteMany({ where: { id: approverId } });
    }
  });

  it("non-finalizer completes a require-approval task → reroutes to pending_approval", async () => {
    const { updateTask } = await import("@/lib/tasks/task-update");
    const { task } = await updateTask(taskId, { status: "done" }, memberId);
    expect(task.status).toBe("pending_approval");

    // Verify DB state.
    const db = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(db.status).toBe("pending_approval");
    expect(db.completedAt).toBeNull();
  });

  it("designated approver approves → moves to done with completion stamp", async () => {
    const { approveTask } = await import("@/lib/tasks/approval-mutations");
    const { task } = await approveTask(taskId, approverId);
    expect(task.status).toBe("done");
    expect(task.completedAt).toBeTruthy();

    const db = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(db.status).toBe("done");
    expect(db.completedAt).toBeTruthy();
    expect(db.progress).toBe(100);
  });

  it("re-opens the task and tests rejection flow", async () => {
    // Re-open for a rejection test.
    const { updateTask } = await import("@/lib/tasks/task-update");
    await updateTask(taskId, { status: "in_progress" }, approverId);
    // Move back to pending_approval.
    await updateTask(taskId, { status: "done" }, approverId);

    // Now reject.
    const { rejectTask } = await import("@/lib/tasks/approval-mutations");
    const { task } = await rejectTask(taskId, approverId, "Missing documentation");
    expect(task.status).toBe("in_progress");

    const db = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(db.status).toBe("in_progress");
    expect(db.approvalNote).toBe("Missing documentation");
    expect(db.completedAt).toBeNull();
  });

  it("non-finalizer cannot approve", async () => {
    // Move to pending_approval.
    const { updateTask } = await import("@/lib/tasks/task-update");
    await updateTask(taskId, { status: "done" }, approverId);

    const { approveTask, TaskNotPendingApprovalError } = await import("@/lib/tasks/approval-mutations");
    // Member is not the designated approver and doesn't have edit_any — should throw.
    await expect(approveTask(taskId, memberId)).rejects.toThrow();

    // Reset.
    await prisma.task.update({ where: { id: taskId }, data: { status: "in_progress" } });
  });

  it("finalizer bypasses the approval gate (direct to done)", async () => {
    const { updateTask } = await import("@/lib/tasks/task-update");
    const { task } = await updateTask(taskId, { status: "done" }, approverId);
    expect(task.status).toBe("done");

    const db = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(db.status).toBe("done");
    expect(db.completedAt).toBeTruthy();
  });

  it("task without requiresApproval goes directly to done", async () => {
    const { updateTask } = await import("@/lib/tasks/task-update");
    const { task } = await updateTask(otherTaskId, { status: "done" }, memberId);
    expect(task.status).toBe("done");

    const db = await prisma.task.findUniqueOrThrow({ where: { id: otherTaskId } });
    expect(db.status).toBe("done");
  });
});
