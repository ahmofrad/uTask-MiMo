import { test, expect } from "@playwright/test";

test("settings page lists active sessions", async ({ page }) => {
  await page.goto("/en-US/settings");
  await page.waitForLoadState("networkidle");

  // The current session must render as "This device".
  await expect(page.getByText("This device").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Last active/i).first()).toBeVisible();
});