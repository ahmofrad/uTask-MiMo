import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@utask.local");
  await page.getByRole("textbox", { name: /password/i }).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(en-US|fa-IR)?\/?$/);
}

const AUTH_PAGES = [
  { name: "dashboard", path: "/" },
  { name: "all tasks", path: "/all" },
  { name: "my tasks", path: "/my-tasks" },
  { name: "projects", path: "/projects" },
  { name: "calendar", path: "/calendar" },
  { name: "settings", path: "/settings" },
] as const;

test.describe("Accessibility", () => {
  test("@a11y login page has no auto-detected violations", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const { name, path } of AUTH_PAGES) {
    test(`@a11y ${name} page has no auto-detected violations`, async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("@a11y rtl (fa-IR) inbox page has no auto-detected violations", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/fa-IR/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
