import { test, expect } from "@playwright/test";

test.describe("Task detail page", () => {
  test("redirects to login when unauthenticated", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/en-US/tasks/nonexistent-id");
    // Should redirect to login or show a not-found state
    await expect(page).not.toHaveURL(/\/tasks\/nonexistent-id/);
    await context.close();
  });

  test("page loads without crashing", async ({ request }) => {
    const res = await request.get("/en-US/tasks/00000000-0000-0000-0000-000000000000");
    // 404 is expected for nonexistent task; 200 with error UI also acceptable
    expect([200, 302, 307, 404]).toContain(res.status());
  });

  test("RTL page loads", async ({ request }) => {
    const res = await request.get("/fa-IR/tasks/00000000-0000-0000-0000-000000000000");
    expect([200, 302, 307, 404]).toContain(res.status());
  });
});

test.describe("Admin pages smoke", () => {
  const adminPages = [
    "admin/templates",
    "admin/ldap-sync",
    "admin/insights",
    "admin/rate-cards",
  ];

  for (const path of adminPages) {
    test(`${path} returns non-500`, async ({ request }) => {
      const res = await request.get(`/en-US/${path}`);
      // Admin pages should redirect to login if unauthenticated, not 500
      expect(res.status()).not.toBe(500);
    });
  }
});