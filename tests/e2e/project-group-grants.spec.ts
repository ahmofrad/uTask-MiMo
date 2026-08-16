import { test, expect } from "@playwright/test";

async function openMembersModal(page: import("@playwright/test").Page) {
  await page.goto("/en-US/projects");
  await page.locator('a[href^="/projects/"]', { hasText: "Work" }).first().click();
  await page.waitForURL(/\/projects\/[\w-]+/);
  await page.getByRole("button", { name: /members/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("Project group grants", () => {
  test("grants, changes, and revokes a group's role", async ({ page }) => {
    await openMembersModal(page);
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Group grants")).toBeVisible();
    await expect(dialog.getByText(/Membership changes apply immediately/)).toBeVisible();

    // Wait for the grants fetch to settle before the defensive cleanup below:
    // checking isVisible() while the section still shows its loading state
    // would skip rows a previous failed run left behind.
    await expect(dialog.getByText("Loading...").first()).toBeHidden({ timeout: 10_000 });

    // Defensive cleanup: a previous failed run may have left grants in place.
    // Clear both seeded groups so the empty-state assertion below is valid.
    for (const group of ["Engineering Team", "Design Team"]) {
      const row = dialog.locator("div.rounded-lg.border", { hasText: group });
      if (await row.isVisible().catch(() => false)) {
        await row.getByRole("button", { name: "Revoke" }).click();
        await expect(row).toBeHidden();
      }
    }
    const engineeringRow = dialog.locator("div.rounded-lg.border", { hasText: "Engineering Team" });

    // Grant "Engineering Team" the contributor role.
    await dialog.getByLabel("Select a group...").selectOption({ label: "Engineering Team" });
    await dialog.getByRole("button", { name: "Grant" }).click();

    await expect(engineeringRow).toBeVisible();
    await expect(engineeringRow).toContainText("4 members");
    await expect(engineeringRow).toContainText("AD");

    // Change the role to lead.
    await engineeringRow.getByRole("combobox").selectOption({ label: "Lead" });
    await expect(engineeringRow).toContainText("Lead");

    // Revoke removes the grant and frees the group for re-granting.
    await engineeringRow.getByRole("button", { name: "Revoke" }).click();
    await expect(engineeringRow).toBeHidden();
    await expect(dialog.getByText("No group has access yet.")).toBeVisible();
  });

  test("notifies group members when a role is granted", async ({ page, browser }) => {
    // Admin grants the manual Design Team a contributor role on Work.
    await openMembersModal(page);
    const dialog = page.getByRole("dialog");

    // Defensive cleanup: a previous failed run may have left the grant in place.
    const designRow = dialog.locator("div.rounded-lg.border", { hasText: "Design Team" });
    if (await designRow.isVisible().catch(() => false)) {
      await designRow.getByRole("button", { name: "Revoke" }).click();
      await expect(designRow).toBeHidden();
    }
    // The picker may sit below the scroll fold inside the dialog; bring it into view.
    await dialog.getByLabel("Select a group...").scrollIntoViewIfNeeded();
    await dialog.getByLabel("Select a group...").selectOption({ label: "Design Team" });
    await dialog.getByRole("button", { name: "Grant" }).click();
    await expect(designRow).toBeVisible();

    // The seeded member (عضو تیم) is in Design Team — they should see the
    // notification in their bell dropdown.
    const context = await browser.newContext({ storageState: ".auth/member.json" });
    const memberPage = await context.newPage();
    try {
      await memberPage.goto("/en-US");
      await memberPage.getByRole("button", { name: "Notifications" }).click();
      await expect(memberPage.getByText("Group access granted").first()).toBeVisible();
      await expect(memberPage.getByText(/Design Team/).first()).toBeVisible();
    } finally {
      await context.close();
    }

    // Cleanup: revoke the grant so reruns stay deterministic.
    await designRow.getByRole("button", { name: "Revoke" }).click();
    await expect(designRow).toBeHidden();
  });

  test("hides grant controls from a viewer", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();
    try {
      await openMembersModal(page);
      const dialog = page.getByRole("dialog");

      // The grants section is visible, but the grant/revoke controls are not.
      await expect(dialog.getByText("Group grants")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Grant" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Revoke" })).toHaveCount(0);
      await expect(dialog.getByLabel("Select a group...")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
