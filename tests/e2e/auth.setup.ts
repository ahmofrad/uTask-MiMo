import { test as setup } from "@playwright/test";

const USERS = {
  admin: { email: "admin@utask.local", password: "password", file: ".auth/admin.json" },
  member: { email: "member@utask.local", password: "password", file: ".auth/member.json" },
  guest: { email: "guest@utask.local", password: "password", file: ".auth/guest.json" },
} as const;

for (const [name, u] of Object.entries(USERS)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(u.email);
    await page.getByRole("textbox", { name: /password/i }).fill(u.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
    await page.context().storageState({ path: u.file });
  });
}
