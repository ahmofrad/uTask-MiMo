import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// Seeded fixtures resolved from the database by name/title in beforeAll rather
// than hardcoded UUIDs. The Work project is used (not Product Launch, which the
// gantt link test mutates) so the specs can run in parallel workers without
// racing over the same rows.
let PROJECT = "";
let TASK_PRED = "";
let TASK_DEP = "";
let TASK_OTHER = "";
let ADMIN_ID = "";

async function createDep(taskId: string, dependsOnId: string) {
  // Idempotent. The unique index covers (taskId, dependsOnId, type) without a
  // deletedAt filter, so any soft-deleted row also blocks recreation — remove
  // every row for the key (hard + soft) before inserting.
  await prisma.taskDependency.deleteMany({ where: { taskId, dependsOnId } });
  await prisma.taskDependency.create({
    data: {
      taskId,
      dependsOnId,
      type: "FINISH_TO_START",
      lag: 0,
      lagUnit: "DAY",
      createdBy: ADMIN_ID,
    },
  });
}

test.describe("Dependency flows", () => {
  // These tests mutate the same seeded tasks, so they must not run in
  // parallel workers (fullyParallel is on globally).
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const work = await prisma.project.findFirstOrThrow({ where: { name: "Work" }, select: { id: true } });
    PROJECT = work.id;
    const byTitle = async (title: string) =>
      (await prisma.task.findFirstOrThrow({ where: { title, projectId: work.id }, select: { id: true } })).id;
    TASK_PRED = await byTitle("Fix login page SSL error");
    TASK_DEP = await byTitle("Design new dashboard layout");
    TASK_OTHER = await byTitle("Investigate database connection pool leak");
    ADMIN_ID = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@utask.local" }, select: { id: true } })).id;
  });

  test.afterEach(async () => {
    await prisma.taskDependency.deleteMany({ where: { taskId: { in: [TASK_PRED, TASK_DEP, TASK_OTHER] } } });
    await prisma.taskDependency.deleteMany({ where: { dependsOnId: { in: [TASK_PRED, TASK_DEP, TASK_OTHER] } } });
  });

  test("edits a dependency's type and lag with its unit on the task detail page", async ({ page }) => {
    const postBodies: Record<string, unknown>[] = [];
    const deleteRequests: string[] = [];
    await page.route("**/api/v1/projects/*/tasks/*/dependencies**", async (route) => {
      const url = route.request().url();
      if (route.request().method() === "POST") {
        postBodies.push(JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>);
        await route.continue();
      } else if (route.request().method() === "DELETE") {
        deleteRequests.push(url);
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.goto(`/en-US/tasks/${TASK_PRED}`);
    const dependsOnBox = page.getByTestId("dep-add-select");
    await expect(dependsOnBox).toBeVisible();
    await dependsOnBox.selectOption({ label: "Design new dashboard layout" });
    await page.getByTestId("dep-add-type").selectOption("START_TO_START");
    await page.getByTestId("dep-add-lag").fill("2");
    await page.getByTestId("dep-add-lag-unit").selectOption("HOUR");
    await page.getByTestId("dep-add-submit").click();

    const row = page.getByTestId("dep-row").filter({ hasText: "Design new dashboard layout" });
    await expect(row).toBeVisible();
    // The row shows the type plus a unit-aware lag suffix (+2h).
    await expect(row).toContainText("Start to Start");
    await expect(row).toContainText("+2h");

    // Inline edit: switch to FF with 1 day of lag (delete + recreate).
    await row.getByTestId("dep-edit").click();
    await row.getByTestId("dep-edit-type").selectOption("FINISH_TO_FINISH");
    await row.getByTestId("dep-edit-lag").fill("1");
    await row.getByTestId("dep-edit-lag-unit").selectOption("DAY");
    await row.getByTestId("dep-edit-save").click();

    await expect(row).toContainText("Finish to Finish");
    await expect(row).toContainText("+1d");
    await expect(row.getByTestId("dep-edit")).toBeVisible();

    await expect.poll(() => postBodies.length).toBe(2);
    expect(postBodies[0]).toEqual({ dependsOnId: TASK_DEP, type: "START_TO_START", lag: 2, lagUnit: "HOUR" });
    expect(postBodies[1]).toEqual({ dependsOnId: TASK_DEP, type: "FINISH_TO_FINISH", lag: 1, lagUnit: "DAY" });
    expect(deleteRequests.length).toBe(1);
  });

  test("shows a blocked badge on the board for a task with an unfinished predecessor", async ({ page }) => {
    await createDep(TASK_DEP, TASK_PRED);
    await page.goto(`/en-US/projects/${PROJECT}`);
    const badge = page.getByTestId("task-blocked-badge");
    await expect(badge).toHaveCount(1);
    // The badge's tooltip names the blocking predecessor.
    await expect(badge).toHaveAttribute("title", /Blocked by.*Fix login page SSL error/);
  });

  test("warns in the task list when a task starts before its predecessor finishes", async ({ page }) => {
    await createDep(TASK_DEP, TASK_PRED);
    // Make the dependent start before the predecessor's due date.
    const pred = await prisma.task.findUniqueOrThrow({ where: { id: TASK_PRED }, select: { dueDate: true } });
    const start = new Date((pred.dueDate?.getTime() ?? Date.now()) - 86400000);
    await prisma.task.update({ where: { id: TASK_DEP }, data: { startDate: start } });

    try {
      await page.goto(`/en-US/projects/${PROJECT}`);
      await page.getByRole("button", { name: "Tasks", exact: true }).click();
      const warning = page.getByTestId("task-dependency-warning");
      await expect(warning).toHaveCount(1);
      await expect(warning).toContainText("Fix login page SSL error");
    } finally {
      await prisma.task.update({ where: { id: TASK_DEP }, data: { startDate: null } });
    }
  });

  test("offers undo when changing dates auto-schedules a dependent", async ({ page }) => {
    // Auto-scheduling only moves leaf tasks (summary rows are never rewritten),
    // so use two leaf tasks here — TASK_PRED (100) has subtasks from an earlier
    // e2e run and is a summary row in the CPM graph.
    const leafPred = TASK_OTHER; // Investigate DB pool leak (leaf, has due date)
    await createDep(TASK_DEP, leafPred);
    const originalDue = await prisma.task.findUniqueOrThrow({ where: { id: leafPred }, select: { dueDate: true } });
    const originalDep = await prisma.task.findUniqueOrThrow({ where: { id: TASK_DEP }, select: { startDate: true, dueDate: true } });

    try {
      await page.goto(`/en-US/tasks/${leafPred}`);
      const dateCard = page.getByRole("heading", { name: "Date & Duration" }).locator("..");
      const duePicker = dateCard.locator('button[aria-haspopup="dialog"]').nth(1);
      await duePicker.click();
      const dialog = page.getByRole("dialog", { name: "Select date" });
      await dialog.getByRole("button", { name: "Next month" }).click();
      await dialog.getByRole("button").filter({ hasText: /^1$/ }).first().click();

      // The dependent was auto-scheduled; an undo toast appears.
      await expect(page.getByText(/was rescheduled to satisfy dependencies/)).toBeVisible();
      await page.getByRole("button", { name: "Undo", exact: true }).click();

      // Restored: the dependent's dates match its pre-change values.
      const beforeStart = originalDep.startDate?.toISOString() ?? null;
      const beforeDue = originalDep.dueDate?.toISOString() ?? null;
      await expect.poll(async () => {
        const dep = await prisma.task.findUniqueOrThrow({ where: { id: TASK_DEP }, select: { startDate: true, dueDate: true } });
        return (dep.startDate?.toISOString() ?? null) === beforeStart && (dep.dueDate?.toISOString() ?? null) === beforeDue;
      }).toBe(true);
    } finally {
      await prisma.task.update({
        where: { id: leafPred },
        data: { dueDate: originalDue.dueDate },
      });
    }
  });

  test("suggests a start date when creating a task with a dependency", async ({ page }) => {
    const pred = await prisma.task.findUniqueOrThrow({ where: { id: TASK_PRED }, select: { dueDate: true } });
    let createdTaskId = "";

    await page.goto(`/en-US/projects/${PROJECT}`);
    await page.getByRole("button", { name: "+ Create task" }).click();

    const titleInput = page.getByTestId("task-form-title");
    await titleInput.fill("E2E dependent task");
    const dependsOn = page.getByTestId("task-form-depends-on");
    await dependsOn.selectOption({ label: "Fix login page SSL error" });

    // The start date is pre-filled from the predecessor's end + the hint shows.
    await expect(page.getByTestId("task-form-suggested-date")).toBeVisible();
    // The start-date picker now displays a concrete date instead of the placeholder.
    const startPicker = page.getByTestId("task-form-start-date").locator('button[aria-haspopup="dialog"]');
    await expect(startPicker).not.toHaveText("Select date");
    await expect(startPicker).toHaveText(/\d/);

    const tasksResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/tasks") && response.request().method() === "POST",
    );
    const depResponse = page.waitForResponse(
      (response) => response.url().includes("/dependencies") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const created = await (await tasksResponse).json();
    createdTaskId = created.data.id as string;
    await depResponse;

    // The created task carries the suggested start date (the predecessor's due).
    const row = await prisma.task.findUniqueOrThrow({ where: { id: createdTaskId }, select: { startDate: true } });
    expect(row.startDate?.toISOString()).toBe(pred.dueDate?.toISOString());
    const edge = await prisma.taskDependency.findFirst({
      where: { taskId: createdTaskId, dependsOnId: TASK_PRED, deletedAt: null },
    });
    expect(edge).not.toBeNull();

    // Cleanup the task the test created.
    await prisma.taskDependency.deleteMany({ where: { taskId: createdTaskId } });
    await prisma.task.deleteMany({ where: { id: createdTaskId } });
  });
});
