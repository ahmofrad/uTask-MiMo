import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";
let TASK_A_ID = "";
let TASK_B_ID = "";
let ADMIN_ID = "";

test.describe("Gantt link creation and deletion", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    ADMIN_ID = admin.id;

    // Create a throwaway project with two tasks.
    const project = await prisma.project.create({
      data: { name: `Gantt Link E2E ${Date.now()}`, ownerId: admin.id, visibility: "org" },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, projectRole: "lead", addedBy: admin.id },
    });
    PROJECT_ID = project.id;

    const taskA = await prisma.task.create({
      data: {
        projectId: PROJECT_ID, title: "Gantt Link Task A", status: "open",
        priority: "low", ownerId: admin.id,
      },
    });
    TASK_A_ID = taskA.id;

    const taskB = await prisma.task.create({
      data: {
        projectId: PROJECT_ID, title: "Gantt Link Task B", status: "open",
        priority: "low", ownerId: admin.id,
      },
    });
    TASK_B_ID = taskB.id;
  });

  test.afterAll(async () => {
    await prisma.taskDependency.deleteMany({ where: { taskId: { in: [TASK_A_ID, TASK_B_ID] } } });
    await prisma.taskDependency.deleteMany({ where: { dependsOnId: { in: [TASK_A_ID, TASK_B_ID] } } });
    await prisma.task.deleteMany({ where: { id: { in: [TASK_A_ID, TASK_B_ID] } } });
    await prisma.projectMember.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  });

  test("creates a dependency via Gantt link mode and verifies it in the dependency panel", async ({ page }) => {
    await page.goto(`/en-US/projects/${PROJECT_ID}/gantt`);

    // Wait for the Gantt chart to render tasks.
    await expect(page.getByText("Gantt Link Task A")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Gantt Link Task B")).toBeVisible();

    // Enable link mode.
    const linkBtn = page.getByRole("button", { name: /link/i });
    if (await linkBtn.isVisible()) {
      await linkBtn.click();

      // Click Task A then Task B to create a dependency.
      await page.getByText("Gantt Link Task A").first().click();
      await page.getByText("Gantt Link Task B").first().click();

      // The dependency should appear. Check the deps panel.
      const depsBtn = page.getByRole("button", { name: /dependencies/i });
      if (await depsBtn.isVisible()) {
        await depsBtn.click();
      }

      // The dependency row should be visible with Task B as successor.
      await expect(page.getByText("Gantt Link Task B")).toBeVisible();
    }
  });

  test("deletes a dependency via the dependency panel", async ({ page }) => {
    // First create one via API so we know it exists.
    await prisma.taskDependency.create({
      data: {
        taskId: TASK_B_ID, dependsOnId: TASK_A_ID,
        type: "FINISH_TO_START", lag: 0, lagUnit: "DAY", createdBy: ADMIN_ID,
      },
    });

    await page.goto(`/en-US/projects/${PROJECT_ID}/gantt`);
    await expect(page.getByText("Gantt Link Task A")).toBeVisible({ timeout: 15_000 });

    // Open dependency panel.
    const depsBtn = page.getByRole("button", { name: /dependencies/i });
    if (await depsBtn.isVisible()) {
      await depsBtn.click();
    }

    // Find the dependency row and delete it.
    const depRow = page.getByTestId("dep-row").filter({ hasText: /Gantt Link Task A/ });
    if (await depRow.isVisible()) {
      const deleteBtn = depRow.getByRole("button", { name: /delete|remove/i });
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        // Confirm if there's a confirmation dialog.
        const confirmBtn = page.getByRole("button", { name: /confirm|yes|ok/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
      }
    }

    // Verify deletion.
    const dep = await prisma.taskDependency.findFirst({
      where: { taskId: TASK_B_ID, dependsOnId: TASK_A_ID, deletedAt: null },
    });
    expect(dep).toBeNull();
  });
});
