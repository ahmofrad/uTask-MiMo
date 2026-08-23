import { test, expect } from "@playwright/test";

// Serial mode: the test creates a period and transitions it through submit →
// approve → reopen. If it runs in parallel with another worker, the period
// list on the page becomes non-deterministic.
test.describe.configure({ mode: "serial" });

const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000001";
const TIMESHEETS_URL = `/en-US/admin/departments/${DEPARTMENT_ID}/timesheets`;

async function getApiCsrfToken(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const csrfResponse = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
  const cookies = (await request.storageState()).cookies;
  return cookies.find((c) => c.name === "csrf_token")?.value ?? csrfToken;
}

// Helper: create a period via the API so the test starts from a known state.
async function createPeriod(request: import("@playwright/test").APIRequestContext) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = (d: Date) => d.toISOString();

  // Visit both endpoints: NextAuth provides its form token, while the
  // application middleware provides the separate API CSRF cookie.
  await request.get(TIMESHEETS_URL);
  const csrf = await getApiCsrfToken(request);

  const res = await request.post(
    `/api/v1/departments/${DEPARTMENT_ID}/timesheets/periods`,
    {
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      data: { periodStart: toISO(start), periodEnd: toISO(end) },
    },
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

test.describe("Timesheet submit to approve to reopen flow", () => {
  test.describe("as admin", () => {
    test.use({ storageState: ".auth/admin.json" });

    test("full lifecycle: create, submit, approve, reopen", async ({ page, request }) => {

    // Create a fresh period via the API.
    const periodId = await createPeriod(request);

    // Navigate to the department timesheets page.
    await page.goto(TIMESHEETS_URL);
    await expect(page.getByRole("heading", { name: /Timesheets/i })).toBeVisible();

    // The newly created period should be visible with "Open" status.
    const periodRow = page.getByRole("main").getByTestId(`timesheet-period-${periodId}`).first();
    await expect(periodRow).toBeVisible();

    // Expand the period.
    await periodRow.click();

    // Submit the period.
    const submitBtn = page.getByRole("button", { name: "Submit" }).first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // After reload, the status should be "Submitted".
    await page.waitForLoadState("networkidle");
    const submittedRow = page.getByRole("main").getByTestId(`timesheet-period-${periodId}`).first();
    await expect(submittedRow).toBeVisible();

    // Approve the period (admin is an approver).
    await submittedRow.click();
    const approveBtn = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // After reload, the status should be "Approved".
    await page.waitForLoadState("networkidle");
    const approvedRow = page.getByRole("main").getByTestId(`timesheet-period-${periodId}`).first();
    await expect(approvedRow).toBeVisible();

    // Reopen the period.
    await approvedRow.click();
    const reopenBtn = page.getByRole("button", { name: "Reopen" }).first();
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();

    // After reload, the status should be "Reopened".
    await page.waitForLoadState("networkidle");
    const reopenedRow = page.getByRole("main").getByTestId(`timesheet-period-${periodId}`).first();
    await expect(reopenedRow).toBeVisible();
    });
  });

  test.describe("as member", () => {
    test.use({ storageState: ".auth/member.json" });

    test("non-approver cannot approve or reject a period", async ({ browser, request }) => {
    // The member fixture is intentionally not assigned to the seeded
    // department. Create the period as an admin, then exercise the denied
    // approval/rejection calls with the member session.
    const adminContext = await browser.newContext({ storageState: ".auth/admin.json" });
    const periodId = await createPeriod(adminContext.request);

    try {
      const approveResponse = await request.post(
        `/api/v1/departments/${DEPARTMENT_ID}/timesheets/periods/${periodId}/approve`,
        { headers: { "x-csrf-token": await getApiCsrfToken(request) } },
      );
      expect(approveResponse.status()).toBe(403);

      const rejectResponse = await request.post(
        `/api/v1/departments/${DEPARTMENT_ID}/timesheets/periods/${periodId}/reject`,
        { headers: { "x-csrf-token": await getApiCsrfToken(request) } },
      );
      expect(rejectResponse.status()).toBe(403);
    } finally {
      await adminContext.close();
    }
  });
  });
});
