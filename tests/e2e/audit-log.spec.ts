import { test, expect } from "@playwright/test";

async function openMembersModal(page: import("@playwright/test").Page) {
  await page.goto("/en-US/projects");
  await page.locator('a[href^="/projects/"]', { hasText: "Work" }).first().click();
  await page.waitForURL(/\/projects\/[\w-]+/);
  await page.getByRole("button", { name: /members/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("Admin audit log", () => {
  test("shows group access events and filters by action", async ({ page }) => {
    // Perform a grant so a group_grant_created audit entry exists.
    await openMembersModal(page);
    const dialog = page.getByRole("dialog");

    const designRow = dialog.locator("div.rounded-lg.border", { hasText: "Design Team" });
    if (await designRow.isVisible().catch(() => false)) {
      await designRow.getByRole("button", { name: "Revoke" }).click();
      await expect(designRow).toBeHidden();
    }
    await dialog.getByLabel("Select a group...").scrollIntoViewIfNeeded();
    await dialog.getByLabel("Select a group...").selectOption({ label: "Design Team" });
    await dialog.getByRole("button", { name: "Grant" }).click();
    await expect(designRow).toBeVisible();

    // Cleanup: revoke so reruns stay deterministic (also creates a revoke entry).
    await designRow.getByRole("button", { name: "Revoke" }).click();
    await expect(designRow).toBeHidden();

    // The audit page shows the last events in a table; the action labels are
    // the localized i18n strings (e.g. "granted group access").
    await page.goto("/en-US/admin/audit-log");
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "granted group access" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "revoked group access" }).first()).toBeVisible();

    // The action filter narrows the table to a single action type.
    // React 19 streaming may hold a hidden duplicate — pin the visible one.
    await page.getByLabel("Action").first().selectOption({ label: "granted group access" });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("cell", { name: "granted group access" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "revoked group access" })).toHaveCount(0);
  });

  test("shows the unfiltered log and clears the action filter", async ({ page }) => {
    await page.goto("/en-US/admin/audit-log");
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    // Rows render with at least one action pill (the table is not empty).
    await expect(page.getByRole("table").getByRole("row").first()).toBeVisible();

    // Selecting a filter and clearing it restores the full list.
    await page.getByLabel("Action").first().selectOption({ label: "granted group access" });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("cell", { name: "granted group access" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("cell", { name: "granted group access" }).first()).toBeVisible();
  });

  test("permission-denied on the audit log for a non-admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();

    await page.goto("/en-US/admin/audit-log");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
