import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@utask.local");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/inbox/);
  });

  test("can view task list", async ({ page }) => {
    await page.goto("/today");
    await expect(page.getByText(/today/i)).toBeVisible();
  });

  test("can navigate to project", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByText(/projects/i)).toBeVisible();
  });

  test("permission-denied on admin page for non-admin", async ({ page }) => {
    // Log in as member
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("member@utask.local");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/inbox/);

    await page.goto("/admin/users");
    await expect(page.getByText(/permission/i)).toBeVisible();
  });
});
