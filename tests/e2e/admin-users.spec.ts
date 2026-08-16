import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

test.describe("Admin Users", () => {
  test("creates a local user from the New user dialog", async ({ page }) => {
    await page.goto("/en-US/admin/users");
    await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible();

    const email = `e2e-user-${Date.now()}@utask.local`;
    const name = "E2E Created User";

    await page.getByRole("button", { name: "New user" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#new-user-email").fill(email);
    await dialog.locator("#new-user-name").fill(name);
    await dialog.locator("#new-user-password").fill("e2e-password-123");
    await dialog.locator("#new-user-role").selectOption({ label: "member" });
    await dialog.getByRole("button", { name: "Create user" }).click();

    // Dialog closes and the new row appears at the top of the table.
    await expect(dialog).toBeHidden();
    const row = page.locator("tbody tr", { hasText: email }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(name);
    await expect(row).toContainText("member");
    await expect(row).toContainText("active");

    // Cleanup: no user-delete endpoint exists, so remove the row directly.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.role.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("shows a conflict error when the email is already in use", async ({ page }) => {
    await page.goto("/en-US/admin/users");
    await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible();

    const email = `dupe-${Date.now()}@utask.local`;
    // Pre-create the user via the API so the dialog's create conflicts.
    const cookies = await page.context().cookies();
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
    const pre = await page.request.post("/api/v1/users", {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: { email, displayName: "Pre Created", password: "e2e-password-123" },
    });
    expect(pre.status()).toBe(201);

    await page.getByRole("button", { name: "New user" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#new-user-email").fill(email);
    await dialog.locator("#new-user-name").fill("Duplicate");
    await dialog.getByRole("button", { name: "Create user" }).click();

    // The dialog stays open with the conflict message.
    await expect(dialog.getByText("Email already in use")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.role.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
