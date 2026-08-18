import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

const PROJECT_ID = "00000000-0000-4000-8000-000000000010";

test.describe("Custom-field filters", () => {
  test("filters the project tasks by a select custom field and clears", async ({ page }) => {
    // Resolve the actual per-task component values from the DB so the test
    // does not depend on seed-specific assignments.
    const values = await prisma.customFieldValue.findMany({
      where: {
        task: { projectId: PROJECT_ID, deletedAt: null, parentTaskId: null },
        customField: { key: "component" },
      },
      select: { task: { select: { title: true } }, valueJson: true },
    });
    const frontendTitles = values
      .filter((v) => v.valueJson === "frontend")
      .map((v) => v.task.title);
    const backendTitles = values
      .filter((v) => v.valueJson === "backend")
      .map((v) => v.task.title);
    expect(frontendTitles.length).toBeGreaterThan(0);
    expect(backendTitles.length).toBeGreaterThan(0);

    await page.goto(`/en-US/projects/${PROJECT_ID}`);
    await page.getByRole("button", { name: "Tasks", exact: true }).click();

    // The filter bar renders the project's custom fields.
    const filterBar = page.getByTestId("task-cf-filters");
    await expect(filterBar).toBeVisible();
    await expect(filterBar.getByText("Story Points")).toBeVisible();
    await expect(filterBar.getByText("Component")).toBeVisible();

    // All tasks are listed before filtering.
    await expect(page.getByText(frontendTitles[0] ?? "")).toBeVisible();
    await expect(page.getByText(backendTitles[0] ?? "")).toBeVisible();

    // Filter Component = Frontend: frontend tasks remain, backend tasks disappear.
    await page.getByTestId("cf-filter-component").selectOption("frontend");
    for (const title of frontendTitles) {
      await expect(page.getByText(title)).toBeVisible();
    }
    for (const title of backendTitles) {
      await expect(page.getByText(title)).toHaveCount(0);
    }

    // Clearing restores the full list.
    await page.getByTestId("task-cf-clear").click();
    await expect(page.getByText(backendTitles[0] ?? "")).toBeVisible();
  });

  test("filters by a number custom field", async ({ page }) => {
    // Pick a (task title, story_points value) pair from the DB.
    const pair = await prisma.customFieldValue.findFirst({
      where: {
        task: { projectId: PROJECT_ID, deletedAt: null, parentTaskId: null },
        customField: { key: "story_points" },
      },
      select: { valueNumber: true, task: { select: { title: true } } },
      orderBy: { task: { title: "asc" } },
    });
    expect(pair?.valueNumber).not.toBeNull();
    const [expectedTitle, expectedValue] = [pair?.task.title ?? "", String(pair?.valueNumber)];

    await page.goto(`/en-US/projects/${PROJECT_ID}`);
    await page.getByRole("button", { name: "Tasks", exact: true }).click();

    await page.getByTestId("cf-filter-story_points").fill(expectedValue);
    await expect(page.getByText(expectedTitle)).toBeVisible();

    // Tasks with a different story_points value are filtered out.
    const other = await prisma.customFieldValue.findFirst({
      where: {
        task: { projectId: PROJECT_ID, deletedAt: null, parentTaskId: null },
        customField: { key: "story_points" },
        NOT: { valueNumber: pair?.valueNumber },
      },
      select: { task: { select: { title: true } } },
    });
    if (other?.task.title) {
      await expect(page.getByText(other.task.title)).toHaveCount(0);
    }
  });
});
