import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

// The seeded AD source fixture, resolved by id so the display name asserted in
// the picker options below always matches what the seed actually created.
async function seededSourceName() {
  return (
    await prisma.ldapSource.findUniqueOrThrow({
      where: { id: "00000000-0000-4000-8000-000000000031" },
      select: { name: true },
    })
  ).name;
}

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
  // fullyParallel is on globally, so these two tests share the LDAP source
  // table across workers — run them serially to avoid racing each other.
  test.describe.configure({ mode: "serial" });

  // The default chromium project carries an authenticated admin storageState,
  // which this spec uses to enable the seeded LDAP source via the SSO API.
  // The standalone `request` fixture keeps its own admin session, so cleanup
  // still works after the page's cookies are cleared for the login view.
  async function csrfToken(request: import("@playwright/test").APIRequestContext) {
    // Load a page first so middleware sets the CSRF cookie the API validates.
    await request.get("/en-US/admin/sso");
    const cookies = (await request.storageState()).cookies;
    return cookies.find((c) => c.name === "csrf_token")?.value ?? "";
  }

  // Interrupted runs of auth.spec / active-directory.spec leave "Second Dir *"
  // and "AD Source *" sources behind. A leftover *enabled* one would break the
  // picker assertions below (extra option + directory label), so remove any
  // test-created sources before each test.
  async function deleteTestSources(request: import("@playwright/test").APIRequestContext) {
    const csrf = await csrfToken(request);
    const res = await request.get("/api/v1/admin/ldap-sources");
    if (!res.ok()) return;
    const body = (await res.json()) as { data?: { id: string; name: string }[] };
    await Promise.all(
      (body.data ?? [])
        .filter((s) => s.name.startsWith("Second Dir ") || s.name.startsWith("AD Source "))
        .map((s) => request.delete(`/api/v1/admin/ldap-sources/${s.id}`, { headers: { "x-csrf-token": csrf } })),
    );
  }

  async function setSeededSourceEnabled(request: import("@playwright/test").APIRequestContext, enabled: boolean) {
    const csrf = await csrfToken(request);
    const res = await request.patch("/api/v1/admin/sso", {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: { ldap: { enabled } },
    });
    expect(res.ok()).toBeTruthy();
  }

  test("login lists enabled AD sources in the directory picker", async ({ page, request }) => {
    await deleteTestSources(request);
    const seededName = await seededSourceName();
    await setSeededSourceEnabled(request, true);

    try {
      // Drop the admin session so /login renders instead of redirecting home.
      await page.context().clearCookies();
      await page.goto("/login");
      // The App Router briefly double-renders during navigation; scope to the
      // first match (see admin-groups.spec.ts).
      const provider = page.locator("#provider").first();
      await expect(provider).toBeVisible();
      await expect(provider.locator("option")).toContainText(["Local login", seededName]);
      // With a single enabled source the selector stays a plain login-method
      // choice (not yet an explicit directory picker).
      await expect(page.getByLabel(/login method/i).first()).toBeVisible();
      await expect(page.getByLabel(/directory/i)).toHaveCount(0);
    } finally {
      await setSeededSourceEnabled(request, false);
    }
  });

  test("login shows an explicit directory picker when 2 sources are enabled", async ({ page, request }) => {
    await deleteTestSources(request);
    const seededName = await seededSourceName();
    await setSeededSourceEnabled(request, true);

    // Create a second enabled source via the admin API (CSRF from the request
    // fixture's own session).
    await request.get("/en-US/admin/active-directory");
    const cookies = (await request.storageState()).cookies;
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
    const name = `Second Dir ${Date.now()}`;
    const create = await request.post("/api/v1/admin/ldap-sources", {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: {
        name,
        enabled: true,
        url: "ldaps://dc.second.local:636",
        bindUpn: "svc@second.local",
        bindPassword: "second-secret",
      },
    });
    expect(create.status()).toBe(201);
    const sourceId = ((await create.json()) as { data: { id: string } }).data.id;

    try {
      await page.context().clearCookies();
      await page.goto("/login");
      const provider = page.locator("#provider").first();
      await expect(provider).toBeVisible();
      // Both directories appear as options, and the label switches to the
      // explicit "Directory" picker.
      await expect(provider.locator("option")).toContainText(["Local login", seededName, name]);
      await expect(page.getByLabel(/directory/i).first()).toBeVisible();
      await expect(page.getByLabel(/login method/i)).toHaveCount(0);
    } finally {
      await request.delete(`/api/v1/admin/ldap-sources/${sourceId}`, {
        headers: { "x-csrf-token": csrf },
      });
      await setSeededSourceEnabled(request, false);
    }
  });
});
