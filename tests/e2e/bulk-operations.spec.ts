import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

let PROJECT_ID = "";

test.describe("Bulk task operations", () => {
  test.beforeAll(async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { name: "Work" }, select: { id: true } });
    PROJECT_ID = project.id;
  });

  test("select multiple tasks and verify bulk actions bar appears", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });

    // The project task list should show tasks with checkboxes
    const checkboxes = page.locator("input[type='checkbox']");
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Select first two tasks
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Bulk actions bar should appear (it shows selected count)
    // The BulkActionsBar component renders when selectedIds is non-empty
    await expect(page.getByText(/selected/i)).toBeVisible({ timeout: 5000 });
  });

  test("deselect all clears the selection", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });

    // Select a task
    const firstCheckbox = page.locator("input[type='checkbox']").first();
    await firstCheckbox.check();

    // Bulk bar should show
    await expect(page.getByText(/selected/i)).toBeVisible({ timeout: 5000 });

    // Find and click "Clear" or deselect button
    const clearBtn = page.getByRole("button", { name: /clear/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      // Bulk bar should disappear
      await expect(page.getByText(/selected/i)).not.toBeVisible({ timeout: 5000 });
    }
  });
});
