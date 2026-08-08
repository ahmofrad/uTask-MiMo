import { test, expect } from "@playwright/test";

test.describe("Unauthenticated visual regression @visual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login-page.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("home page renders in dark mode", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await expect(page).toHaveScreenshot("login-page-dark.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("login page in RTL", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "fa-IR");
    });
    await expect(page).toHaveScreenshot("login-page-rtl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

});

test.describe("Authenticated visual regression @visual", () => {
  test("admin page renders correctly", async ({ page, context }) => {
    // Must be logged in as admin — stub session cookie
    await context.addCookies([
      { name: "next-auth.session-token", value: "mock-session", domain: "localhost", path: "/" },
    ]);
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("admin-users.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("tasks page rendered", async ({ page }) => {
    await page.goto("/my-tasks");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("tasks-list.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
