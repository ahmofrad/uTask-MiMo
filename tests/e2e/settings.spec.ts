import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("can navigate to settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("settings shows appearance section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/appearance/i).last()).toBeVisible();
  });
});
