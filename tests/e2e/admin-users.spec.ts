import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

async function findInviteLink(email: string): Promise<string | null> {
  // The dev environment sends mail to MailHog; read the latest message for the
  // invitee and extract the /invite/ URL from its plain-text body. The MIME
  // body is quoted-printable, so undo the soft line breaks first.
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch("http://localhost:8025/api/v2/messages");
    const data = (await res.json()) as {
      items?: { Content?: { Headers?: { To?: string[] }; Body?: string } }[];
    };
    const message = data.items?.find((m) =>
      m.Content?.Headers?.To?.[0]?.toLowerCase().includes(email.toLowerCase()),
    );
    const body = (message?.Content?.Body ?? "").replace(/=\r?\n/g, "");
    const match = body.match(/https?:\/\/[^\s]+/);
    if (match?.[0]?.includes("/invite/")) return match[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

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

  test("invites a user by email and lets them accept the invite link", async ({ page, browser }) => {
    await page.goto("/en-US/admin/users");
    await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible();

    const email = `invite-${Date.now()}@utask.local`;
    const name = "Invited Person";

    // Create with no password -> invited status + invite email is sent.
    await page.getByRole("button", { name: "New user" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#new-user-email").fill(email);
    await dialog.locator("#new-user-name").fill(name);
    await dialog.getByRole("button", { name: "Create user" }).click();
    await expect(dialog).toBeHidden();
    const row = page.locator("tbody tr", { hasText: email }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("invited");
    await expect(row.getByRole("button", { name: "Resend invite" })).toBeVisible();

    // Grab the invite link from MailHog and open it as the invitee.
    const inviteUrl = await findInviteLink(email);
    expect(inviteUrl).toContain("/invite/");
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    await inviteePage.goto(inviteUrl);
    await expect(inviteePage.getByRole("heading", { name: "You've been invited" })).toBeVisible();
    await inviteePage.locator("#displayName").fill("Jane Doe");
    await inviteePage.locator("#password").fill("invite-password-123");
    await inviteePage.getByRole("button", { name: "Accept invitation" }).click();

    // Signed in automatically and dropped into the app.
    await expect(inviteePage.getByText("Account created. Signing you in...")).toBeVisible();
    await inviteePage.waitForURL(/(\/en-US|\/fa-IR)?\/?$/, { timeout: 10_000 });
    await inviteeContext.close();

    // The admin table now shows the user as active.
    await page.reload();
    const activeRow = page.locator("tbody tr", { hasText: email }).first();
    await expect(activeRow).toContainText("active");

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
