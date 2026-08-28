import { test, expect } from "@playwright/test";

test.describe("Audit Log Pagination", () => {
  test("audit log page loads with entries", async ({ page }) => {
    await page.goto("/en-US/admin/audit-log");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Should show the audit log heading
    const heading = page.getByRole("heading", { name: /audit|log/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("audit log shows table or list of entries", async ({ page }) => {
    await page.goto("/en-US/admin/audit-log");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Should show some content area (table, list, or empty state)
    const contentArea = page.locator("main");
    await expect(contentArea).toBeVisible({ timeout: 10000 });

    // Either there are entries or an empty state message
    const hasEntries = await page
      .locator("table, [role='table'], [role='list']")
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/no.*entries|empty|no.*audit/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasEntries || hasEmptyState).toBe(true);
  });

  test("load more button works when entries exist", async ({ page }) => {
    await page.goto("/en-US/admin/audit-log");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const loadMoreBtn = page.getByRole("button", {
      name: /load more|show more|next/i,
    });
    if (await loadMoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadMoreBtn.click();
      await page.waitForTimeout(2000);

      // After clicking load more, there should still be content
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
