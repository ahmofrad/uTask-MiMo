import { test, expect } from "@playwright/test";

test.describe("Project members", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@taskapp.local");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign/i }).click();
    await page.waitForURL(/\//);
  });

  test("can navigate to project and see members", async ({ page }) => {
    await page.goto("/projects");
    // Click first project link
    const projectLink = page.locator("a[href^='/projects/']").first();
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/[\w-]+/);
    // Should see member count or members link
    await expect(page.locator("text=/member/i")).toBeVisible();
  });
});
