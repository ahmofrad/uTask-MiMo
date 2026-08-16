import { test, expect } from "@playwright/test";

test.describe("Email templates", () => {
  test("shows a live HTML preview with sample values filled in", async ({ page }) => {
    await page.goto("/en-US/admin/settings/email-templates");
    await expect(page.getByRole("heading", { name: "Email Templates" })).toBeVisible();

    // The preview is hidden until toggled.
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("button", { name: "Preview" }).first().click();

    const frame = page.frameLocator("iframe").first();
    // Default invite template renders with the sample link resolved.
    await expect(frame.getByText("Accept invitation")).toBeVisible();
    await expect(frame.locator("a[href='https://app.example.com/invite/sample-token']")).toBeVisible();

    // Editing the HTML re-renders the preview live.
    const html = page.getByLabel("HTML body (optional)").first();
    await html.fill("<p>Hello {{email}},</p><p><a href=\"{{link}}\">Join now</a></p>");
    await expect(frame.getByText("Hello member@example.com,")).toBeVisible();
    await expect(frame.getByText("Join now")).toBeVisible();

    // Toggling hides the preview again.
    await page.getByRole("button", { name: "Hide preview" }).first().click();
    await expect(page.locator("iframe")).toHaveCount(0);
  });

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
