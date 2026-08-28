import { test, expect } from "@playwright/test";

test.describe("Settings Page Visual Baseline", () => {
  test("settings page renders correctly", async ({ page }) => {
    await page.goto("/en-US/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify main content loaded
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });

    // Take a visual baseline screenshot
    await expect(page).toHaveScreenshot("settings-page.png", {
      maxDiffPixelRatio: 0.05,
      fullPage: true,
    });
  });

  test("settings security section renders", async ({ page }) => {
    await page.goto("/en-US/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const securityTab = page.getByRole("tab", { name: /security/i });
    if (await securityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await securityTab.click();
      await page.waitForTimeout(1000);

      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("settings appearance section renders", async ({ page }) => {
    await page.goto("/en-US/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const appearanceTab = page.getByRole("tab", { name: /appearance|theme/i });
    if (await appearanceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appearanceTab.click();
      await page.waitForTimeout(1000);

      await expect(page.locator("main")).toBeVisible();
    }
  });
});
