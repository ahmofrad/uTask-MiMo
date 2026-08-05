import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "uTask" })).toBeVisible();
});
