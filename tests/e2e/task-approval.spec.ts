import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Each test builds its own throwaway project + task, so the specs can run in
// parallel. Cleanup happens inside the test body (never afterAll) because
// fullyParallel workers may tear down shared hooks mid-flight.

async function setupApprovalTask() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@utask.local" },
    select: { id: true },
  });
  const manager = await prisma.user.findUniqueOrThrow({
    where: { email: "manager@utask.local" },
    select: { id: true },
  });
  const member = await prisma.user.findUniqueOrThrow({
    where: { email: "member@utask.local" },
    select: { id: true },
  });

  const project = await prisma.project.create({
    data: {
      name: `Approval E2E ${Date.now()}`,
      ownerId: admin.id,
      visibility: "org",
      members: {
        create: [
          {
            user: { connect: { id: member.id } },
            addedByUser: { connect: { id: admin.id } },
            projectRole: "contributor",
          },
          {
            user: { connect: { id: manager.id } },
            addedByUser: { connect: { id: admin.id } },
            projectRole: "lead",
          },
        ],
      },
    },
  });

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Approval gate e2e task",
      description: "Created by the approval-gate e2e suite.",
      status: "in_progress",
      createdById: member.id,
      reporterId: member.id,
      requiresApproval: true,
      approverId: manager.id,
      assignees: { create: [{ userId: member.id }] },
    },
  });

  return {
    projectId: project.id,
    taskId: task.id,
    memberId: member.id,
    managerId: manager.id,
  };
}

async function cleanupApprovalTask(projectId: string) {
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
}

async function completeAsMember(browser: Browser, taskId: string) {
  const ctx = await browser.newContext({ storageState: ".auth/member.json" });
  const page = await ctx.newPage();
  await page.goto(`/en-US/tasks/${taskId}`);
  await expect(page.getByRole("heading", { name: "Approval gate e2e task" })).toBeVisible({
    timeout: 45000,
  });
  // The header card's status select (labeled, unlike the header language picker).
  // React 19 streaming Suspense may hold a hidden duplicate — pin the visible one.
  const statusSelect = page.getByLabel("Status").first();
  await statusSelect.selectOption("done");
  await expect(statusSelect).toHaveValue("pending_approval", { timeout: 10000 });
  await ctx.close();
}

test.describe("Task approval gate", () => {
  test.setTimeout(90_000);

  test("a DONE transition on a require-approval task reroutes to pending_approval, and the approver approves from the UI", async ({
    browser,
  }) => {
    const { projectId, taskId } = await setupApprovalTask();
    try {
      // A plain contributor completes the task; the gate reroutes it.
      await completeAsMember(browser, taskId);

      // The designated approver sees the approval banner and approves.
      const managerCtx = await browser.newContext({ storageState: ".auth/manager.json" });
      const managerPage = await managerCtx.newPage();
      await managerPage.goto(`/en-US/tasks/${taskId}`);
      // The task page is server-rendered; during hydration React 19's
      // streaming Suspense container transiently holds a hidden duplicate of
      // the page (getByText matches hidden elements), so pin the visible
      // main-content copy with .first() — the same pattern as the visual specs.
      const banner = managerPage.getByTestId("task-approval-banner");
      await expect(banner.first()).toBeVisible({ timeout: 10000 });
      await managerPage.getByRole("button", { name: "Approve" }).click();
      await expect(banner.first()).toBeHidden({ timeout: 10000 });
      await expect(managerPage.getByLabel("Status").first()).toHaveValue("done");
      await managerCtx.close();

      // The final state is persisted server-side.
      const task = await prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { status: true },
      });
      expect(task.status).toBe("done");
    } finally {
      await cleanupApprovalTask(projectId);
    }
  });

  test("a rejection requires a reason and sends the task back to in_progress", async ({
    browser,
  }) => {
    const { projectId, taskId } = await setupApprovalTask();
    try {
      await completeAsMember(browser, taskId);

      const managerCtx = await browser.newContext({ storageState: ".auth/manager.json" });
      const managerPage = await managerCtx.newPage();
      await managerPage.goto(`/en-US/tasks/${taskId}`);
      const banner = managerPage.getByTestId("task-approval-banner");
      await expect(banner.first()).toBeVisible({ timeout: 10000 });

      // Rejecting with an empty reason is blocked client-side.
      await managerPage.getByRole("button", { name: "Reject" }).click();
      await managerPage.getByRole("button", { name: "Reject" }).click();
      await expect(managerPage.getByText("A reason is required to reject")).toBeVisible();

      // Filling the reason rejects and returns the task to in_progress.
      await managerPage.getByPlaceholder("Reason for rejection").fill("Missing the rollout plan");
      await managerPage.getByRole("button", { name: "Reject" }).click();
      await expect(banner.first()).toBeHidden({ timeout: 10000 });
      await expect(managerPage.getByLabel("Status").first()).toHaveValue("in_progress");
      await managerCtx.close();

      const task = await prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { status: true, approvalNote: true },
      });
      expect(task.status).toBe("in_progress");
      expect(task.approvalNote).toBe("Missing the rollout plan");
    } finally {
      await cleanupApprovalTask(projectId);
    }
  });

  test("approve/reject are denied to non-finalizers and require a reason via the API", async ({
    browser,
  }) => {
    const { projectId, taskId } = await setupApprovalTask();
    try {
      const memberCtx = await browser.newContext({ storageState: ".auth/member.json" });
      const memberApi = memberCtx.request;
      // State-changing requests need the CSRF header the middleware enforces;
      // read the token from the context's cookies like apiFetch does.
      const csrf = (await memberCtx.cookies()).find((c) => c.name === "csrf_token")?.value ?? "";
      const csrfHeaders = { "x-csrf-token": csrf };

      // A contributor CAN edit the task (edit_own) but is not a finalizer, so
      // marking it done reroutes it to the approval queue.
      const patch = await memberApi.patch(`/api/v1/tasks/${taskId}`, {
        data: { status: "done" },
        headers: csrfHeaders,
      });
      expect(patch.ok()).toBeTruthy();
      expect(((await patch.json()) as { data: { status: string } }).data.status).toBe(
        "pending_approval",
      );

      // The same contributor attempting to approve is denied.
      const approveRes = await memberApi.post(`/api/v1/tasks/${taskId}/approve`, {
        headers: csrfHeaders,
      });
      expect(approveRes.status()).toBe(403);

      // A rejection without a reason is a 400.
      const managerCtx = await browser.newContext({ storageState: ".auth/manager.json" });
      const managerCsrf =
        (await managerCtx.cookies()).find((c) => c.name === "csrf_token")?.value ?? "";
      const rejectRes = await managerCtx.request.post(`/api/v1/tasks/${taskId}/reject`, {
        data: {},
        headers: { "x-csrf-token": managerCsrf },
      });
      expect(rejectRes.status()).toBe(400);
      expect(((await rejectRes.json()) as { error: { code: string } }).error.code).toBe(
        "APPROVAL_REASON_REQUIRED",
      );

      await memberCtx.close();
      await managerCtx.close();
    } finally {
      await cleanupApprovalTask(projectId);
    }
  });
});
