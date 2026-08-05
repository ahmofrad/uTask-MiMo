import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@utask.local");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
  });

  test("can view task list", async ({ page }) => {
    await page.goto("/my-tasks");
    await expect(page.getByText(/my tasks/i).last()).toBeVisible();
  });

  test("can navigate to project", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("permission-denied on admin page for non-admin", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Log in as guest
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("guest@utask.local");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
