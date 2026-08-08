import { test, expect } from "@playwright/test";

test.describe("Project members", () => {
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
