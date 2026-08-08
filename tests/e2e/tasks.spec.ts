import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test("can view task list", async ({ page }) => {
    await page.goto("/my-tasks");
    await expect(page.getByText(/my tasks/i).last()).toBeVisible();
  });

  test("can navigate to project", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("permission-denied on admin page for non-admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
