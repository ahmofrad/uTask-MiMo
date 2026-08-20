import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Guards against the MISSING_MESSAGE class of bugs: the task activity timeline
// calls t(`audit.actions.${action}`) unconditionally, so an untranslated
// AuditAction enum value throws in the browser instead of degrading gracefully
// (raw key in en-US). scripts/i18n-check.ts enforces coverage statically; this
// spec proves the rendered timeline actually shows the translated strings.
async function setupAuditTimelineTask() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@utask.local" },
    select: { id: true },
  });
  const project = await prisma.project.create({
    data: {
      name: `Timeline i18n E2E ${Date.now()}`,
      ownerId: admin.id,
      visibility: "org",
    },
  });
  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Timeline i18n e2e task",
      status: "done",
      createdById: admin.id,
      reporterId: admin.id,
      requiresApproval: true,
      approverId: admin.id,
    },
  });

  // The timeline renders whatever audit rows exist for the task regardless of
  // how they were produced; seeding them directly keeps the spec deterministic
  // (fixed titles avoid depending on the full approve flow).
  const base = { entityType: "task", entityId: task.id, actorUserId: admin.id };
  await prisma.auditLog.createMany({
    data: [
      { ...base, action: "task_approved", afterJson: { status: "done" } },
      { ...base, action: "task_rejected", afterJson: { status: "in_progress" } },
    ],
  });

  return { projectId: project.id, taskId: task.id };
}

async function cleanupTimelineTask(projectId: string, taskId: string) {
  await prisma.auditLog.deleteMany({
    where: { entityType: "task", entityId: taskId },
  });
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
}

test.describe("i18n", () => {
  test("loads English locale", async ({ page }) => {
    await page.goto("/en-US");
    await expect(page).toHaveURL(/\/en-US/);
  });

  test("activity timeline renders task_approved/task_rejected in fa-IR", async ({ page }) => {
    const { projectId, taskId } = await setupAuditTimelineTask();
    try {
      await page.goto(`/fa-IR/tasks/${taskId}`);
      const timeline = page.getByTestId("activity-timeline").first();
      await expect(timeline).toBeVisible({ timeout: 15000 });

      // The approved/rejected rows must show the fa-IR strings, not raw keys
      // (which is what next-intl falls back to for a missing message).
      await expect(timeline.getByText("وظیفه را تأیید کرد")).toBeVisible();
      await expect(timeline.getByText("وظیفه را رد کرد")).toBeVisible();
    } finally {
      await cleanupTimelineTask(projectId, taskId);
    }
  });
});
