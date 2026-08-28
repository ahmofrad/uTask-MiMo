import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@/lib/db";

const AUTH_PAGES = [
  { name: "dashboard", path: "/" },
  { name: "workspace", path: "/workspace" },
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
      // Socket.IO keeps a connection alive — networkidle never settles.
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("@a11y rtl (fa-IR) inbox page has no auto-detected violations", async ({ page }) => {
    await page.goto("/fa-IR/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const { name, path } of [
    { name: "admin departments", path: "/admin/departments" },
    { name: "admin rate cards", path: "/admin/rate-cards" },
    { name: "admin webhooks", path: "/admin/webhooks" },
    { name: "admin webhook deliveries", path: "/admin/webhook-deliveries" },
    { name: "admin groups", path: "/admin/groups" },
    { name: "admin users", path: "/admin/users" },
    { name: "admin tokens", path: "/admin/tokens" },
    { name: "admin ldap sync", path: "/admin/ldap-sync" },
    { name: "admin audit log", path: "/admin/audit-log" },
  ] as const) {
    test(`@a11y rtl (fa-IR) ${name} has no auto-detected violations`, async ({ page }) => {
      await page.goto(`/fa-IR${path}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  // Task detail page a11y
  test("@a11y task detail page has no auto-detected violations", async ({ page }) => {
    const task = await prisma.task.findFirstOrThrow({
      where: { project: { name: "Product Launch" } },
      select: { id: true },
    });
    await page.goto(`/tasks/${task.id}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // RTL Gantt chart a11y
  test("@a11y rtl (fa-IR) gantt chart has no auto-detected violations", async ({ page }) => {
    const project = await prisma.project.findFirstOrThrow({
      where: { name: "Product Launch" },
      select: { id: true },
    });
    await page.goto(`/fa-IR/projects/${project.id}`);
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    await expect(page.getByTestId("gantt-scroll-container").first()).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // The newest project views live inside the project detail page, which the
  // AUTH_PAGES sweep above does not cover. Check the board (default tab), the
  // Gantt chart, and the WBS tree explicitly.
  // These navigate without a locale prefix, so tabs render in the default
  // (en-US) locale — match the English tab labels.
  for (const { name, tab, containerId } of [
    { name: "project board", tab: null, containerId: null },
    { name: "project gantt", tab: "Gantt", containerId: "gantt-scroll-container" },
    { name: "project wbs", tab: "WBS", containerId: "wbs-editor" },
  ] as const) {
    test(`@a11y ${name} view has no auto-detected violations`, async ({ page }) => {
      const project = await prisma.project.findFirstOrThrow({
        where: { name: "Product Launch" },
        select: { id: true },
      });
      await page.goto(`/projects/${project.id}`);
      if (tab) {
        await page.getByRole("button", { name: tab, exact: true }).click();
      }
      const container = containerId
        ? page.getByTestId(containerId).first()
        : page.locator("main").first();
      await expect(container).toBeVisible({ timeout: 15000 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
