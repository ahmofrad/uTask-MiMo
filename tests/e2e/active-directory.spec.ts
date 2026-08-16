import { test, expect, type Page } from "@playwright/test";

async function apiRequest(
  page: Page,
  method: "post" | "patch" | "delete",
  url: string,
  csrf: string,
  data?: unknown,
) {
  const opts: Record<string, unknown> = {
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
  };
  if (data !== undefined) opts.data = data;
  return page.request[method](url, opts);
}

test.describe("Active Directory admin page", () => {
  test("admin can create, list, and delete an LDAP source", async ({ page }) => {
    // Load the page once so middleware sets the CSRF cookie the API validates.
    await page.goto("/en-US/admin/active-directory");
    await expect(page.getByRole("heading", { name: /active directory/i })).toBeVisible();
    const cookies = await page.context().cookies();
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const name = `AD Source ${Date.now()}`;

    const create = await apiRequest(page, "post", "/api/v1/admin/ldap-sources", csrf, {
      name,
      enabled: true,
      url: "ldaps://dc.example.local:636",
      bindUpn: "svc-utask@example.local",
      bindPassword: "test-password",
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    const sourceId = created.data.id as string;

    try {
      // The App Router briefly double-renders layouts during navigation, so
      // scope text assertions to the first match (see admin-groups.spec.ts).
      await page.reload();
      const row = page.locator("tbody tr", { hasText: name }).first();
      await expect(page.locator("tbody tr", { hasText: name })).toHaveCount(1);
      await expect(row).toContainText("Enabled");
      await expect(row).toContainText("dc.example.local");
      await expect(row).not.toContainText("test-password");

      // Enable/disable toggle round-trips.
      const toggle = await apiRequest(page, "patch", `/api/v1/admin/ldap-sources/${sourceId}`, csrf, {
        enabled: false,
      });
      expect(toggle.status()).toBe(200);
      await page.reload();
      await expect(page.locator("tbody tr", { hasText: name }).first()).toContainText("Disabled");

      // Edit renames the source.
      const renamed = `${name} Renamed`;
      const edit = await apiRequest(page, "patch", `/api/v1/admin/ldap-sources/${sourceId}`, csrf, {
        name: renamed,
      });
      expect(edit.status()).toBe(200);
      await page.reload();
      await expect(page.locator("tbody tr", { hasText: renamed })).toHaveCount(1);
    } finally {
      await apiRequest(page, "delete", `/api/v1/admin/ldap-sources/${sourceId}`, csrf);
      await page.reload();
      await expect(page.locator("tbody tr", { hasText: name })).toHaveCount(0);
      await expect(page.locator("tbody tr", { hasText: `${name} Renamed` })).toHaveCount(0);
    }
  });
});
