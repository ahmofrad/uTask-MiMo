import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const AUTH_PAGES = [
  { name: "dashboard", path: "/" },
  { name: "all tasks", path: "/all" },
  { name: "my tasks", path: "/my-tasks" },
  { name: "projects", path: "/projects" },
  { name: "calendar", path: "/calendar" },
  { name: "settings", path: "/settings" },
] as const;

test.describe("Accessibility", () => {
  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("@a11y login page has no auto-detected violations", async ({ page }) => {
      await page.goto("/login");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });

  for (const { name, path } of AUTH_PAGES) {
    test(`@a11y ${name} page has no auto-detected violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("@a11y rtl (fa-IR) inbox page has no auto-detected violations", async ({ page }) => {
    await page.goto("/fa-IR/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
