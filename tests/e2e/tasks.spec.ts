import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test("can view task list", async ({ page }) => {
    await page.goto("/my-tasks");
    await expect(page.getByText(/my tasks/i).last()).toBeVisible();
  });

  test("can navigate to project", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("groups start, due, and end dates and saves picker values", async ({ page }) => {
    const patchBodies: Record<string, unknown>[] = [];
    await page.route("**/api/v1/tasks/00000000-0000-0000-0000-000000000100", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      const postData = route.request().postData();
      patchBodies.push(JSON.parse(postData ?? "{}") as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    });

    await page.goto("/en-US/tasks/00000000-0000-0000-0000-000000000100");
    const dateCard = page.getByRole("heading", { name: "Date & Duration" }).locator("..");
    await expect(dateCard).toBeVisible();
    await expect(dateCard.locator("label")).toHaveText(["Start Date", "Due date", "End Date", "Duration"]);
    const estimatedTime = dateCard.getByText("Estimated time", { exact: true });
    await expect(estimatedTime).toBeVisible();
    await expect(estimatedTime.locator("..")).toContainText("Days");
    await expect(dateCard.getByText(/^Created:/)).toBeVisible();
    await expect(dateCard.getByText(/^Updated:/)).toBeVisible();
    const detailsCard = page.getByRole("heading", { name: "Assignees" }).locator("..");
    await expect(detailsCard.getByText("Estimated", { exact: true })).not.toBeVisible();

    const datePickers = dateCard.locator('button[aria-haspopup="dialog"]');
    await expect(datePickers).toHaveCount(3);
    for (const index of [0, 1, 2]) {
      await datePickers.nth(index).click();
      await page.getByRole("dialog").locator('button[aria-label*="Mordad"]').first().click();
    }

    await expect.poll(() => patchBodies.length).toBe(3);
    expect(patchBodies[0]?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(patchBodies[1]?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(patchBodies[2]?.endDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);

    const dependenciesCard = page.getByRole("heading", { name: "Dependencies" }).locator("..");
    const dependsOnHeading = dependenciesCard.getByRole("heading", { name: "Depends on" });
    const blocksHeading = dependenciesCard.getByRole("heading", { name: "Blocks" });
    await expect(dependsOnHeading).toBeVisible();
    await expect(blocksHeading).toBeVisible();
    const dependsOnBox = await dependsOnHeading.boundingBox();
    const blocksBox = await blocksHeading.boundingBox();
    expect(dependsOnBox).not.toBeNull();
    expect(blocksBox).not.toBeNull();
    expect(Math.abs((dependsOnBox?.y ?? 0) - (blocksBox?.y ?? 0))).toBeLessThan(8);
  });

  test("permission-denied on admin page for non-admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ".auth/guest.json" });
    const page = await context.newPage();

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
    await context.close();
  });
});
