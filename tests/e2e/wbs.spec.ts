import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const ADMIN_EMAIL = "admin@utask.local";
const MEMBER_EMAIL = "member@utask.local";

async function apiPost(
  page: Page,
  context: BrowserContext,
  url: string,
  data: unknown,
): Promise<string> {
  const cookies = await context.cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
  const res = await page.request.post(url, {
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      "idempotency-key": `e2e-${Date.now()}-${Math.random()}`,
    },
    data,
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data.id as string;
}

async function createProject(page: Page, context: BrowserContext, name: string) {
  return apiPost(page, context, "/api/v1/projects", { name });
}

async function createTask(
  page: Page,
  context: BrowserContext,
  projectId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return apiPost(page, context, "/api/v1/tasks", { projectId, title, ...extra });
}

async function getUserId(page: Page, email: string): Promise<string> {
  const res = await page.request.get("/api/v1/users");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const list: Array<{ id: string; email: string }> = body.data ?? body;
  const user = list.find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);
  return user.id;
}

test.describe("WBS editor", () => {
  test("shows WBS codes, rollup, and supports indent + progress", async ({ page, context }) => {
    const projectId = await createProject(page, context, `WBS E2E ${Date.now()}`);
    const a = await createTask(page, context, projectId, "WBS A");
    const a1 = await createTask(page, context, projectId, "WBS A1", {
      parentTaskId: a,
      progress: 0,
    });
    const a2 = await createTask(page, context, projectId, "WBS A2", {
      parentTaskId: a,
      progress: 100,
    });
    const b = await createTask(page, context, projectId, "WBS B");

    await page.goto(`/projects/${projectId}/wbs`);

    await expect(page.locator(`[data-task-id="${a1}"] [data-testid="wbs-code"]`)).toHaveText("1.1");
    await expect(page.locator(`[data-task-id="${a2}"] [data-testid="wbs-code"]`)).toHaveText("1.2");
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("2");

    // rollup of A = (0 + 100) / 2 = 50%
    await expect(page.locator(`[data-task-id="${a}"]`)).toContainText("50%");

    // indent B under A -> becomes 1.3
    const bRow = page.locator(`[data-task-id="${b}"]`);
    await bRow.hover();
    await bRow.getByTestId("wbs-indent").click();
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("1.3", { timeout: 15000 });

    // bump A1 to 100% -> A rollup = (100 + 100 + 0) / 3 = 67%
    const slider = page.locator(`[data-task-id="${a1}"] [data-testid="wbs-progress"]`);
    await slider.fill("100");
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator(`[data-task-id="${a}"]`)).toContainText("67%");
  });

  test("allows a project member to reorganize the WBS", async ({ browser }) => {
    const adminCtx = await browser.newContext({ storageState: ".auth/admin.json" });
    const adminPage = await adminCtx.newPage();
    const projectId = await createProject(adminPage, adminCtx, `WBS Member E2E ${Date.now()}`);

    const memberId = await getUserId(adminPage, MEMBER_EMAIL);
    const addRes = await adminPage.request.post(`/api/v1/projects/${projectId}/members`, {
      headers: { "content-type": "application/json", "x-csrf-token": (await adminCtx.cookies()).find((c) => c.name === "csrf_token")?.value ?? "" },
      data: { userId: memberId, projectRole: "contributor" },
    });
    expect(addRes.status()).toBe(201);

    const a = await createTask(adminPage, adminCtx, projectId, "M A");
    const b = await createTask(adminPage, adminCtx, projectId, "M B");
    await adminCtx.close();

    const memberCtx = await browser.newContext({ storageState: ".auth/member.json" });
    const page = await memberCtx.newPage();
    await page.goto(`/projects/${projectId}/wbs`);
    await expect(page.locator(`[data-task-id="${a}"] [data-testid="wbs-code"]`)).toHaveText("1");
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("2");

    const bRow = page.locator(`[data-task-id="${b}"]`);
    await bRow.hover();
    await bRow.getByTestId("wbs-indent").click();
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("1.1");
    await memberCtx.close();
  });

  test("provides a searchable planning outline with visible metadata and controls", async ({ page, context }) => {
    const projectId = await createProject(page, context, `WBS Planning ${Date.now()}`);
    const parent = await createTask(page, context, projectId, "Release plan");
    const child = await createTask(page, context, projectId, "API implementation", {
      parentTaskId: parent,
      status: "in_progress",
      priority: "high",
      progress: 40,
    });
    const unrelated = await createTask(page, context, projectId, "Design review");

    await page.goto(`/projects/${projectId}/wbs`);

    await expect(page.getByTestId("wbs-editor")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work breakdown structure" })).toBeVisible();
    await expect(page.getByTestId("wbs-column-header")).toContainText("Task");
    await expect(page.getByTestId("wbs-column-header")).toContainText("Status");
    await expect(page.getByTestId("wbs-column-header")).toContainText("Priority");
    await expect(page.getByTestId("wbs-column-header")).toContainText("Progress");
    await expect(page.locator(`[data-task-id="${parent}"] [data-testid="wbs-row-actions"]`)).toBeVisible();
    await expect(page.locator(`[data-task-id="${child}"]`)).toContainText("In progress");
    await expect(page.locator(`[data-task-id="${child}"]`)).toContainText("High");

    await page.getByTestId("wbs-search").fill("API implementation");
    await expect(page.locator(`[data-task-id="${child}"]`)).toBeVisible();
    await expect(page.locator(`[data-task-id="${unrelated}"]`)).toBeHidden();
    await expect(page.locator(`[data-task-id="${parent}"]`)).toBeVisible();
  });

  test("adds a root task from the WBS toolbar", async ({ page, context }) => {
    const projectId = await createProject(page, context, `WBS Quick Add ${Date.now()}`);
    await createTask(page, context, projectId, "Existing work");

    await page.goto(`/projects/${projectId}/wbs`);
    await page.getByTestId("wbs-add-root").click();
    await page.getByTestId("wbs-root-title").fill("New work package");
    await page.getByTestId("wbs-root-title").press("Enter");

    await expect(page.getByText("New work package", { exact: true })).toBeVisible();
  });

  test("keeps the outline usable on a narrow viewport without body overflow", async ({ page, context }) => {
    const projectId = await createProject(page, context, `WBS Mobile ${Date.now()}`);
    const parent = await createTask(page, context, projectId, "Mobile parent");
    await createTask(page, context, projectId, "Mobile child", { parentTaskId: parent });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${projectId}/wbs`);
    const table = page.getByTestId("wbs-editor").locator(".overflow-x-auto");
    await expect(table).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    const tableDimensions = await table.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    expect(tableDimensions.scrollWidth).toBeGreaterThan(tableDimensions.clientWidth);
    await expect(page.getByTestId("wbs-column-header").locator("span").first()).toHaveCSS("position", "sticky");
    await expect(page.getByTestId("wbs-search")).toBeVisible();
    await expect(page.getByTestId("wbs-add-root")).toBeVisible();
  });

  test("uses the same planning outline on the dashboard WBS view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "WBS" }).click();

    await expect(page.getByTestId("dashboard-wbs")).toBeVisible();
    await expect(page.getByTestId("dashboard-wbs-column-header")).toContainText("Project");
    await expect(page.getByTestId("dashboard-wbs-search")).toBeVisible();
    await expect(page.getByTestId("dashboard-wbs-expand-all")).toBeVisible();
    await expect(page.getByTestId("dashboard-wbs-collapse-all")).toBeVisible();
  });
});