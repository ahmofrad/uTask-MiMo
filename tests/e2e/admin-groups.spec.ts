import { test, expect } from "@playwright/test";

// Tests in this file mutate the same seeded groups (e.g. add/remove
// member@utask.local on Engineering Team), so they must not run in parallel
// even though the suite uses fullyParallel.
test.describe.configure({ mode: "serial" });

test.describe("Admin Groups", () => {
  test("shows Groups and Departments as separate menu items", async ({ page }) => {
    await page.goto("/en-US/admin/groups");
    await expect(page.getByRole("heading", { name: "Groups", exact: true })).toBeVisible();
    // The App Router briefly double-renders layouts during navigation, so scope
    // to the first match instead of asserting a strict count.
    await expect(page.locator('nav a[href="/admin/departments"]').first()).toBeVisible();
    await expect(page.locator('nav a[href="/admin/groups"]').first()).toBeVisible();
  });

  test("expands and collapses the member list for a sync group", async ({ page }) => {
    await page.goto("/en-US/admin/groups");

    // The DN only appears in the Engineering Team row; the row is the
    // bordered card div (not its ancestors), so scope by class + text.
    const row = page
      .locator('div.rounded-lg.border', { hasText: "cn=engineering-team,dc=company,dc=local" })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("4 members");
    await expect(row).toContainText("Department: Engineering Team");

    // Expand the member list
    await row.getByRole("button", { name: "Show members" }).click();
    for (const name of ["John Smith", "سارا محمدی", "علی رضایی", "سرپرست تیم"]) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
    for (const email of ["john@utask.local", "sara@utask.local", "ali@utask.local", "manager@utask.local"]) {
      await expect(page.getByText(email).first()).toBeVisible();
    }

    // Collapse the member list
    await row.getByRole("button", { name: "Hide members" }).click();
    await expect(page.getByText("john@utask.local").first()).toBeHidden();
  });

  test("creates a manual group with an owner department", async ({ page }) => {
    await page.goto("/en-US/admin/groups");

    const name = `QA Team ${Date.now()}`;
    await page.getByRole("button", { name: "New group" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").fill(name);
    await dialog.getByRole("combobox").selectOption({ label: "Finance" });
    await dialog.getByRole("button", { name: "Create group" }).click();

    // The new group appears as a row with a Manual badge and the owner dept.
    const row = page
      .locator(`input[aria-label="Group name"][value="${name}"]`)
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-lg ')][1]");
    await expect(row).toBeVisible();
    await expect(row).toContainText("Manual");
    await expect(row).toContainText("0 members");
    await expect(row).toContainText("Owner department: Finance");

    // Cleanup: deleting the group removes it from the list.
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toBeHidden();
  });

  test("adds and removes a member on a sync group", async ({ page }) => {
    await page.goto("/en-US/admin/groups");

    const row = page
      .locator("div.rounded-lg.border", { hasText: "cn=engineering-team,dc=company,dc=local" })
      .first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Show members" }).click();

    const memberEmail = "member@utask.local";
    const memberEmailText = page.getByText(memberEmail).first();

    // Defensive cleanup: a previous failed run may have left the member added.
    if (await memberEmailText.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Remove عضو تیم/ }).click();
      await expect(memberEmailText).toBeHidden();
    }

    // Search for the user and add them to the group.
    await page.getByPlaceholder("Search users to add...").fill("عضو تیم");
    await memberEmailText.click();
    await expect(memberEmailText).toBeVisible();
    await expect(row).toContainText("5 members");

    // Removing the member updates the list and count.
    await page.getByRole("button", { name: /Remove عضو تیم/ }).click();
    await expect(memberEmailText).toBeHidden();
    await expect(row).toContainText("4 members");
  });

  test.describe("Scoped department manager", () => {
    test.use({ storageState: ".auth/manager.json" });

    test("sees the Groups nav item and a scoped group list", async ({ page }) => {
      // The manager gets a dedicated Groups link (no full Admin section).
      await page.goto("/");
      await expect(page.locator('nav a[href="/admin/groups"]').first()).toBeVisible();
      await expect(page.locator('nav a[href="/admin/users"]')).toHaveCount(0);

      await page.locator('nav a[href="/admin/groups"]').first().click();
      await page.waitForURL(/\/admin\/groups/);
      await expect(page.getByRole("heading", { name: "Groups", exact: true })).toBeVisible();

      // Scoped to their department subtree: Design Team (owned by Product,
      // under Engineering) is visible; Engineering Team is outside it.
      await expect(page.locator('input[value="Design Team"]').first()).toBeVisible();
      await expect(page.locator('input[value="Engineering Team"]')).toHaveCount(0);

      // The note explains why some groups are hidden from the scoped list.
      await expect(page.getByText(/Showing \d+ group\(s\) in your department subtree/)).toBeVisible();

      // And they can add a member to a group in their subtree.
      const row = page
        .locator("div.rounded-lg.border", { has: page.locator('input[value="Design Team"]') })
        .first();
      await row.getByRole("button", { name: "Show members" }).click();
      await page.getByPlaceholder("Search users to add...").fill("guest");
      await page.getByText("guest@utask.local").first().click();
      await expect(page.getByText("guest@utask.local").first()).toBeVisible();
      await expect(row).toContainText("3 members");

      // Cleanup: remove the member again so later runs start from seed state.
      await page.getByRole("button", { name: /Remove مهمان/ }).click();
      await expect(page.getByText("guest@utask.local").first()).toBeHidden();
      await expect(row).toContainText("2 members");
    });
  });

  test("existing members never appear as add suggestions", async ({ page }) => {
    await page.goto("/en-US/admin/groups");

    const row = page
      .locator("div.rounded-lg.border", { hasText: "cn=engineering-team,dc=company,dc=local" })
      .first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Show members" }).click();

    // Type immediately (before the member list resolves) — the race that used
    // to surface existing members as add suggestions and double-add them.
    await page.getByPlaceholder("Search users to add...").fill("سارا");
    await page.waitForTimeout(1200);

    // Sara is already in the group: the member list shows exactly one row for
    // her and the suggestions list stays empty (no duplicate is possible).
    await expect(page.getByText("sara@utask.local")).toHaveCount(1);
    await expect(page.locator("div.relative ul li")).toHaveCount(0);
    await expect(row).toContainText("4 members");
  });

  test("permission-denied on the Groups page for a non-admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();

    await page.goto("/en-US/admin/groups");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
