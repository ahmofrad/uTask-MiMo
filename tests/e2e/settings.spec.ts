import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@utask.local");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /sign/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
  });

  test("can navigate to settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("settings shows appearance section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/appearance/i).last()).toBeVisible();
  });
});
