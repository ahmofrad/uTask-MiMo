import { test, expect } from "@playwright/test";

async function openMembersModal(page: import("@playwright/test").Page) {
  await page.goto("/en-US/projects");
  await page.locator('a[href^="/projects/"]', { hasText: "Work" }).first().click();
  await page.waitForURL(/\/projects\/[\w-]+/);
  await page.getByRole("button", { name: /members/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("Admin audit log", () => {
  test("filters to group access events and shows grant details", async ({ page }) => {
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

    // The audit page defaults to all events; switch to the group-access filter.
    await page.goto("/en-US/admin/audit-log");
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    await page.getByRole("link", { name: "Group access" }).click();
    await expect(page).toHaveURL(/\/admin\/audit-log\?groupAccess=true/);

    // The grant + revoke entries are visible with resolved group/project names.
    await expect(page.getByText("granted group access").first()).toBeVisible();
    await expect(page.getByText("revoked group access").first()).toBeVisible();
    const grantRow = page.getByText("granted group access").first().locator("xpath=ancestor::tr");
    await expect(grantRow).toContainText("Design Team");
    await expect(grantRow).toContainText("Work");
    await expect(grantRow).toContainText("contributor");
  });

  test("all-events tab shows the unfiltered log", async ({ page }) => {
    await page.goto("/en-US/admin/audit-log?groupAccess=true");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page).toHaveURL(/\/admin\/audit-log$/);
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
  });

  test("permission-denied on the audit log for a non-admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();

    await page.goto("/en-US/admin/audit-log");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
