import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearLockout, isLockedOut } from "@/lib/auth/lockout";

const EMAIL = `lockout-${Date.now()}@utask.local`;
const PASSWORD = "password";

/**
 * G16e — password lockout: after AUTH_MAX_FAILED_ATTEMPTS (default 5) failed
 * local logins the account is locked for AUTH_LOCKOUT_MINUTES and even the
 * correct password is rejected until the window passes (or Redis is cleared).
 * Uses a dedicated local user and clears the lockout in afterAll.
 */
test.describe("Password lockout", () => {
  test.describe.configure({ mode: "serial" });

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: EMAIL },
      update: {
        passwordHash: bcrypt.hashSync(PASSWORD, 12),
        status: "active",
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodesHashed: [],
      },
      create: {
        email: EMAIL,
        displayName: "Lockout E2E",
        passwordHash: bcrypt.hashSync(PASSWORD, 12),
        locale: "en_US",
        status: "active",
      },
    });
  });

  test.afterAll(async () => {
    await clearLockout(EMAIL);
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  test("five wrong passwords lock the account, then the correct one fails too", async ({ page }) => {
    await page.goto("/login");

    // 5 wrong attempts — the 5th one trips the lockout.
    for (let i = 0; i < 5; i++) {
      await page.getByLabel(/email/i).fill(EMAIL);
      await page.getByRole("textbox", { name: /password/i }).fill("wrong-password");
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page.getByText(/invalid/i)).toBeVisible();
    }

    // Redis agrees the account is locked.
    await expect.poll(() => isLockedOut(EMAIL)).toBe(true);

    // Even the correct password is now rejected while locked.
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});