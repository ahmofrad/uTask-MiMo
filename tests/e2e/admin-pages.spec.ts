import { test, expect } from "@playwright/test";

// Smoke coverage for admin pages that previously had no spec. Each page is a
// server-rendered (or immediately-hydrating) route whose <h1> is present in the
// initial HTML, so asserting it is a cheap regression guard against 404s,
// auth redirects, and render crashes.
const ADMIN_PAGES: ReadonlyArray<{ path: string; heading: string | RegExp }> = [
  { path: "/admin/backups", heading: "Backups" },
  { path: "/admin/departments", heading: "Departments" },
  { path: "/admin/insights", heading: "Organization Insights" },
  { path: "/admin/ldap-sync", heading: "LDAP Sync Dashboard" },
  { path: "/admin/health", heading: "Health" },
  { path: "/admin/rate-cards", heading: /rate cards/i },
  { path: "/admin/sso", heading: "SSO Configuration" },
  { path: "/admin/storage", heading: "Storage Configuration" },
  { path: "/admin/tokens", heading: "API Tokens" },
  { path: "/admin/templates", heading: "Templates" },
  { path: "/admin/webhooks", heading: "Webhooks" },
  { path: "/admin/webhook-deliveries", heading: "Webhook Deliveries" },
] as const;

for (const { path, heading } of ADMIN_PAGES) {
  test(`admin page ${path} renders`, async ({ page }) => {
    await page.goto(`/en-US${path}`);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  });
}

test("notifications page renders", async ({ page }) => {
  await page.goto("/en-US/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
});
