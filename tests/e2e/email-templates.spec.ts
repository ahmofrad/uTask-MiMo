import { test, expect } from "@playwright/test";

test.describe("Email templates", () => {
  test("edits the invite template and persists it", async ({ page }) => {
    await page.goto("/en-US/admin/settings/email-templates");
    await expect(page.getByRole("heading", { name: "Email Templates" })).toBeVisible();

    const subject = page.getByLabel("Subject").first();
    await expect(subject).toBeVisible();
    await subject.fill("You're invited to Acme");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Templates saved. They take effect immediately.")).toBeVisible();

    // Persisted through the API.
    const res = await page.request.get("/api/v1/admin/settings/email-templates");
    const body = (await res.json()) as { data?: { invite_subject?: string } };
    expect(body.data?.invite_subject).toBe("You're invited to Acme");

    // Restore the default so other specs see the default subject.
    await subject.fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Templates saved. They take effect immediately.")).toBeVisible();
  });
});
