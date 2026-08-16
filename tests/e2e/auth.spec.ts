import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
  });

  test("login with valid credentials redirects to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@utask.local");
    await page.getByRole("textbox", { name: /password/i }).fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
    await expect(page).toHaveURL(/\/(en-US|fa-IR)?\/?$/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("wrong@email.com");
    await page.getByRole("textbox", { name: /password/i }).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test("unauthenticated user redirected to login", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Active Directory directory picker", () => {
  // The default chromium project carries an authenticated admin storageState,
  // which this spec uses to enable the seeded LDAP source via the SSO API.
  // The standalone `request` fixture keeps its own admin session, so cleanup
  // still works after the page's cookies are cleared for the login view.
  async function setSeededSourceEnabled(request: import("@playwright/test").APIRequestContext, enabled: boolean) {
    // Load a page first so middleware sets the CSRF cookie the API validates.
    await request.get("/en-US/admin/sso");
    const cookies = (await request.storageState()).cookies;
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
    const res = await request.patch("/api/v1/admin/sso", {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: { ldap: { enabled } },
    });
    expect(res.ok()).toBeTruthy();
  }

  test("login lists enabled AD sources in the directory picker", async ({ page, request }) => {
    await setSeededSourceEnabled(request, true);

    try {
      // Drop the admin session so /login renders instead of redirecting home.
      await page.context().clearCookies();
      await page.goto("/login");
      await expect(page.locator("#provider")).toBeVisible();
      await expect(page.locator("#provider option")).toContainText(["Local login", "Company Directory"]);
      await expect(page.getByLabel(/login method/i)).toBeVisible();
    } finally {
      await setSeededSourceEnabled(request, false);
    }
  });
});
