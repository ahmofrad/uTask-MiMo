import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateTotpToken } from "@/lib/auth/two-factor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

const EMAIL = "2fa@utask.local";
const PASSWORD = "password";

// Plaintext TOTP secret captured during enrollment (the DB copy is encrypted,
// so it cannot be re-read from prisma for code generation).
let enrolledSecret = "";

/**
 * G16c — 2FA enrollment + two-step login challenge, end to end.
 *
 * Uses a dedicated local user so the shared auth.setup storage states are
 * never affected. The flow: enroll through the settings UI (QR/secret +
 * verify), then sign out and sign back in — the second step must require a
 * TOTP code before a session is issued.
 */
test.describe("Two-factor authentication", () => {
  test.describe.configure({ mode: "serial" });

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { email: "admin@utask.local" },
      select: { id: true },
    });
    const user = await prisma.user.upsert({
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
        displayName: "2FA E2E",
        passwordHash: bcrypt.hashSync(PASSWORD, 12),
        locale: "en_US",
        status: "active",
      },
    });
    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id } },
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id, role: "member" },
      update: {},
    });
    const role = await prisma.role.findFirst({
      where: { userId: user.id, organizationId: DEFAULT_ORGANIZATION_ID, type: "member", scopeType: "global" },
    });
    if (!role) {
      await prisma.role.create({
        data: {
          userId: user.id,
          organizationId: DEFAULT_ORGANIZATION_ID,
          type: "member",
          scopeType: "global",
          scopeId: null,
          grantedBy: admin.id,
        },
      });
    }
  });

  test.afterAll(async () => {
    // Leave 2FA disabled so a re-run can enroll again from scratch.
    await prisma.user.update({
      where: { email: EMAIL },
      data: { totpEnabled: false, totpSecret: null, totpRecoveryCodesHashed: [] },
    });
  });

  async function loginWithPassword(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
  }

  test("enrolls TOTP from the settings UI", async ({ page }) => {
    await loginWithPassword(page);
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);

    await page.goto("/settings");
    // During hydration React 19's streaming Suspense container transiently
    // holds a hidden duplicate of the page (getByText matches hidden
    // elements), so pin the visible copy with .first().
    await expect(page.getByText("Enable two-factor authentication").first()).toBeVisible();

    await page.getByRole("button", { name: "Enable two-factor authentication" }).click();

    // Secret is rendered plaintext once so it can be entered manually.
    const secret = await page.getByTestId("totp-secret").textContent();
    expect(secret).toBeTruthy();
    enrolledSecret = secret!.trim();

    const code = generateTotpToken(enrolledSecret);
    await page.getByLabel("Verification code").fill(code);
    await page.getByRole("button", { name: "Verify and enable" }).click();

    // Recovery codes appear exactly once. React strips inter-element
    // whitespace, so textContent has no separators — count the spans instead.
    const codes = page.getByTestId("recovery-codes");
    await expect(codes.first()).toBeVisible();
    await expect(codes.locator("span")).toHaveCount(8);
    // Each code should be a 12-character token.
    const firstCode = (await codes.locator("span").first().textContent())?.trim() ?? "";
    expect(firstCode).toHaveLength(12);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Two-factor authentication is enabled").first()).toBeVisible();
  });

  test("sign-in requires the TOTP code after enrollment", async ({ page }) => {
    await page.context().clearCookies();

    await loginWithPassword(page);

    // Step 1 (password) done → the OTP step must appear, not a session.
    const otp = page.locator("#otp");
    await expect(otp).toBeVisible({ timeout: 15_000 });

    // A wrong code stays on the OTP step with an error.
    await otp.fill("000000");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByText(/invalid or expired code/i)).toBeVisible();

    // Correct code completes the second step and opens the app.
    await otp.fill(generateTotpToken(enrolledSecret));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
  });
});