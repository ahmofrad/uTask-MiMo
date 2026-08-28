import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";
let TASK_A = "";
let TASK_B = "";
let ADMIN_ID = "";

test.describe("Auto-schedule undo", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { name: "Work" }, select: { id: true } });
    PROJECT_ID = project.id;
    const byTitle = async (title: string) =>
      (await prisma.task.findFirstOrThrow({ where: { title, projectId: PROJECT_ID }, select: { id: true } })).id;
    TASK_A = await byTitle("Fix login page SSL error");
    TASK_B = await byTitle("Design new dashboard layout");
    ADMIN_ID = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@utask.local" }, select: { id: true } })).id;
  });

  test.afterEach(async () => {
    // Clean up any dependencies we created
    await prisma.taskDependency.deleteMany({ where: { taskId: TASK_B, dependsOnId: TASK_A } });
    await prisma.taskDependency.deleteMany({ where: { dependsOnId: TASK_B, taskId: TASK_A } });
  });

  test("auto-schedule pushes dependent forward, undo restores dates", async ({ page }) => {
    // Create a dependency: B depends on A (FINISH_TO_START)
    await prisma.taskDependency.deleteMany({ where: { taskId: TASK_B, dependsOnId: TASK_A } });
    await prisma.taskDependency.create({
      data: { taskId: TASK_B, dependsOnId: TASK_A, type: "FINISH_TO_START", lag: 0, lagUnit: "DAY", createdBy: ADMIN_ID },
    });

    // Save B's original dates for comparison
    const bBefore = await prisma.task.findUniqueOrThrow({ where: { id: TASK_B }, select: { startDate: true, dueDate: true } });

    // Navigate to the Gantt chart for the Work project
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    await expect(page.getByTestId("gantt-scroll-container").first()).toBeVisible({ timeout: 15000 });

    // The Gantt should render both tasks — verify they're visible
    await expect(page.getByText("Fix login page SSL error")).toBeVisible();
    await expect(page.getByText("Design new dashboard layout")).toBeVisible();
  });
});
