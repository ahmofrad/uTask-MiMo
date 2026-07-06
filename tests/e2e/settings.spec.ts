import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@taskapp.local");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign/i }).click();
    await page.waitForURL(/\//);
  });

  test("can navigate to settings profile", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("can navigate to settings appearance", async ({ page }) => {
    await page.goto("/settings/appearance");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
