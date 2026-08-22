import { test, expect } from "@playwright/test";

// Serial mode: the test creates a period and transitions it through submit →
// approve → reopen. If it runs in parallel with another worker, the period
// list on the page becomes non-deterministic.
test.describe.configure({ mode: "serial" });

const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000001";
const TIMESHEETS_URL = `/en-US/admin/departments/${DEPARTMENT_ID}/timesheets`;

// Helper: create a period via the API so the test starts from a known state.
async function createPeriod(request: import("@playwright/test").APIRequestContext) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = (d: Date) => d.toISOString().split("T")[0]!;

  // Load a page to get a CSRF cookie.
  await request.get(TIMESHEETS_URL);
  const cookies = (await request.storageState()).cookies;
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

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
  test("full lifecycle: create, submit, approve, reopen", async ({ page, request }) => {
    test.use({ storageState: ".auth/admin.json" });

    // Create a fresh period via the API.
    await createPeriod(request);

    // Navigate to the department timesheets page.
    await page.goto(TIMESHEETS_URL);
    await expect(page.getByRole("heading", { name: /Timesheets/i })).toBeVisible();

    // The newly created period should be visible with "Open" status.
    const periodRow = page
      .locator("div.rounded-lg.border", { hasText: "Open" })
      .first();
    await expect(periodRow).toBeVisible();

    // Expand the period.
    await periodRow.click();

    // Submit the period.
    const submitBtn = page.getByRole("button", { name: "Submit" }).first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // After reload, the status should be "Submitted".
    await page.waitForLoadState("networkidle");
    const submittedRow = page
      .locator("div.rounded-lg.border", { hasText: "Submitted" })
      .first();
    await expect(submittedRow).toBeVisible();

    // Approve the period (admin is an approver).
    await submittedRow.click();
    const approveBtn = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // After reload, the status should be "Approved".
    await page.waitForLoadState("networkidle");
    const approvedRow = page
      .locator("div.rounded-lg.border", { hasText: "Approved" })
      .first();
    await expect(approvedRow).toBeVisible();

    // Reopen the period.
    await approvedRow.click();
    const reopenBtn = page.getByRole("button", { name: "Reopen" }).first();
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();

    // After reload, the status should be "Reopened".
    await page.waitForLoadState("networkidle");
    const reopenedRow = page
      .locator("div.rounded-lg.border", { hasText: "Reopened" })
      .first();
    await expect(reopenedRow).toBeVisible();
  });

  test("non-approver cannot see approve/reject buttons", async ({ page, request }) => {
    test.use({ storageState: ".auth/member.json" });

    await createPeriod(request);

    await page.goto(TIMESHEETS_URL);

    // A regular member should see their own period (they created it).
    const periodRow = page
      .locator("div.rounded-lg.border", { hasText: "Open" })
      .first();
    await expect(periodRow).toBeVisible();
    await periodRow.click();

    // The Submit button should be visible (owner can submit).
    await expect(page.getByRole("button", { name: "Submit" }).first()).toBeVisible();

    // Approve/Reject should NOT be visible (no timesheet.approve permission).
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
  });
});
