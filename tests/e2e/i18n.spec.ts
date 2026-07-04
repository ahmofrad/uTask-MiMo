import { test, expect } from "@playwright/test";

test.describe("i18n", () => {
  test("loads English locale", async ({ page }) => {
    await page.goto("/en-US");
    await expect(page).toHaveURL(/\/en-US/);
  });
});
