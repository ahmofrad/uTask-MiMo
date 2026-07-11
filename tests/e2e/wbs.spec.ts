import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const ADMIN_EMAIL = "admin@utask.local";
const ADMIN_PASSWORD = "password123";
const MEMBER_EMAIL = "member@utask.local";
const MEMBER_PASSWORD = "password123";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/inbox/);
}

async function apiPost(
  page: Page,
  context: BrowserContext,
  url: string,
  data: unknown,
): Promise<string> {
  const cookies = await context.cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
  const res = await page.request.post(url, {
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
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
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
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
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("1.3");

    // bump A1 to 100% -> A rollup becomes 100%
    const slider = page.locator(`[data-task-id="${a1}"] [data-testid="wbs-progress"]`);
    await slider.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = "100";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    await page.waitForTimeout(250);
    await page.reload();
    await expect(page.locator(`[data-task-id="${a}"]`)).toContainText("100%");
  });

  test("allows a project member to reorganize the WBS", async ({ page, context }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projectId = await createProject(page, context, `WBS Member E2E ${Date.now()}`);

    const memberId = await getUserId(page, MEMBER_EMAIL);
    const addRes = await page.request.post(`/api/v1/projects/${projectId}/members`, {
      headers: { "content-type": "application/json", "x-csrf-token": (await context.cookies()).find((c) => c.name === "csrf_token")?.value ?? "" },
      data: { userId: memberId, projectRole: "member" },
    });
    expect(addRes.status()).toBe(201);

    const a = await createTask(page, context, projectId, "M A");
    const b = await createTask(page, context, projectId, "M B");

    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto(`/projects/${projectId}/wbs`);
    await expect(page.locator(`[data-task-id="${a}"] [data-testid="wbs-code"]`)).toHaveText("1");
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("2");

    const bRow = page.locator(`[data-task-id="${b}"]`);
    await bRow.hover();
    await bRow.getByTestId("wbs-indent").click();
    await expect(page.locator(`[data-task-id="${b}"] [data-testid="wbs-code"]`)).toHaveText("1.1");
  });
});
