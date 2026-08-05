import { test, expect } from "@playwright/test";

test.describe("Project members", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@utask.local");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /sign/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
  });

  test("can navigate to project and see members", async ({ page }) => {
    await page.goto("/projects");
    // Click first project link
    const projectLink = page.locator("a[href^='/projects/']").first();
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/[\w-]+/);
    // Should see member count or members link
    await expect(page.getByRole("button", { name: /member/i })).toBeVisible();
  });
});
