import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { WORKING_DAYS_SETTING_KEY } from "@/lib/date/working-day";
import { HOLIDAY_EGRESS_SETTING_KEY } from "@/lib/date/holidays/download";

// NOTE: with `fullyParallel: true`, tests in this file can run in different
// workers, and a file-level afterAll would fire as soon as the fast test
// finishes — deleting the config while the slow test is still mid-flight.
// Cleanup therefore lives inside the test body (try/finally), never in an
// afterAll hook.

test.describe("Working days admin page", () => {
  // All tests share the single InstanceSetting row, so concurrent workers
  // would race each other's writes and cleanups. Run serially.
  test.describe.configure({ mode: "serial" });

  test("admin can configure weekend days and holidays, and they persist", async ({ page }) => {
    try {
      await page.goto("/en-US/admin/settings/working-days");
      await expect(page.getByRole("heading", { name: "Working days & holidays" })).toBeVisible();

      // The weekend section renders all seven weekday toggles; Saturday is off.
      const saturday = page.getByTestId("wd-weekend-6");
      await expect(saturday).toHaveAttribute("aria-pressed", "false");
      await saturday.click();
      await expect(saturday).toHaveAttribute("aria-pressed", "true");

      // Add a holiday through the Jalali picker, selecting today via the
      // picker's shortcut, and give it a name.
      await page.getByTestId("wd-add-holiday").click();
      const picker = page.getByTestId("wd-holiday-date-0");
      await picker.click();
      // Exactly one picker is open, so its footer "Today" is unambiguous.
      await expect(page.getByRole("button", { name: "Today" })).toHaveCount(1);
      await page.getByRole("button", { name: "Today" }).click();
      await page.getByTestId("wd-holiday-name-0").fill("Test holiday");

      // A second, date-only holiday (no name) must also be valid.
      await page.getByTestId("wd-add-holiday").click();
      await page.getByTestId("wd-holiday-date-1").click();
      await expect(page.getByRole("button", { name: "Today" })).toHaveCount(1);
      await page.getByRole("button", { name: "Today" }).click();

      // Save and confirm the success message.
      await page.getByTestId("wd-save").click();
      await expect(page.getByTestId("wd-msg")).toContainText("saved");

      // The API persists exactly what the page showed; both holidays carry
      // today's local date and the second one an empty name.
      const expectedDate = await page.evaluate(() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      });
      const res = await page.request.get("/api/v1/admin/settings/working-days");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        data?: { weekendDays: number[]; holidays: { date: string; name: string }[] };
      };
      expect(body.data?.weekendDays).toEqual([6]);
      expect(body.data?.holidays).toEqual([
        { date: expectedDate, name: "Test holiday" },
        { date: expectedDate, name: "" },
      ]);

      // Reload: the saved state is rendered back (weekend toggle stays on and
      // the picker shows a selected date instead of the placeholder).
      await page.reload();
      await expect(page.getByTestId("wd-weekend-6")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("wd-holiday-date-0")).not.toContainText("Select date");
    } finally {
      // Restore the default calendar (every day working) so other suites that
      // assume no working-day config stay deterministic.
      await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    }
  });

  test("configured holidays are marked on the calendar and Gantt views", async ({ page }) => {
    // Use today as the holiday so it is guaranteed to be inside the calendar
    // month and the Gantt timeline (which spans the task dates ± padding).
    const today = await page.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    try {
      await prisma.instanceSetting.upsert({
        where: { key: WORKING_DAYS_SETTING_KEY },
        create: {
          key: WORKING_DAYS_SETTING_KEY,
          value: {
            weekendDays: [6], // Saturday
            holidays: [{ date: today, name: "Test holiday" }],
          },
        },
        update: {
          value: {
            weekendDays: [6],
            holidays: [{ date: today, name: "Test holiday" }],
          },
        },
      });

      // Calendar view: today's cell is marked as a holiday with its name.
      await page.goto("/en-US/calendar");
      const cell = page.locator(`[data-testid="calendar-holiday"][data-date="${today}"]`);
      await expect(cell).toBeVisible({ timeout: 10000 });
      await expect(cell).toHaveAttribute("title", "Test holiday");
      // The legend explains the holiday marker.
      await expect(page.getByText("Holiday", { exact: true })).toBeVisible();
      // Saturday is the configured weekend — it renders the weekend tint.
      const saturday = await page.evaluate(() => {
        const d = new Date();
        const day = d.getDay();
        const delta = (6 - day + 7) % 7;
        const target = new Date(d);
        target.setDate(d.getDate() + delta);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      });
      await expect(
        page.locator(`[data-testid="calendar-day"][data-date="${saturday}"]`),
      ).toBeVisible();

      // Gantt view: the timeline day for the holiday shows its name in the
      // styled tooltip when hovered (replacing the native title attribute).
      const project = await prisma.project.findFirstOrThrow({
        where: { name: "Product Launch" },
        select: { id: true },
      });
      await page.goto(`/en-US/projects/${project.id}`);
      await page.getByRole("button", { name: "Gantt", exact: true }).click();
      const chart = page.getByTestId("gantt-scroll-container").first();
      await expect(chart).toBeVisible({ timeout: 15000 });
      const holidayCell = chart.locator(
        `[data-testid="gantt-timeline-day"][data-holiday-name="Test holiday"]`,
      );
      await expect(holidayCell).toBeVisible({ timeout: 15000 });
      await holidayCell.hover();
      const tooltip = page.getByTestId("gantt-holiday-tooltip");
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText("Test holiday");
    } finally {
      // Restore the default calendar so other suites stay deterministic.
      await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    }
  });

  test("official and CSV imports add holidays", async ({ page }) => {
    const today = await page.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    const tomorrow = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    try {
      await page.goto("/en-US/admin/settings/working-days");
      await expect(page.getByRole("heading", { name: "Working days & holidays" })).toBeVisible();

      // Bundled official import: defaults are Iran + current/next year.
      await page.getByTestId("wd-import-official-btn").click();
      await expect(page.getByTestId("wd-import-msg")).toContainText("Added");
      await expect(page.getByTestId("wd-no-holidays")).toBeHidden();

      // CSV import: two rows with computed dates, both must land.
      const csv = `${today},Test CSV Holiday\n${tomorrow},Test CSV Holiday 2`;
      await page.getByTestId("wd-import-csv-text").fill(csv);
      await page.getByTestId("wd-import-csv-btn").click();
      await expect(page.getByTestId("wd-import-msg")).toContainText("Added 2 holidays");

      // The imported CSV dates are persisted through the API.
      const res = await page.request.get("/api/v1/admin/settings/working-days");
      const body = (await res.json()) as { data?: { holidays: { date: string; name: string }[] } };
      const dates = body.data?.holidays.map((holiday) => holiday.date) ?? [];
      expect(dates).toContain(today);
      expect(dates).toContain(tomorrow);
    } finally {
      // Restore the default calendar so other suites stay deterministic.
      await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    }
  });

  test("switching the egress provider switches its base URL", async ({ page }) => {
    try {
      // Start from a clean slate: a real saved key (e.g. the admin's own
      // Calendarific key in the dev DB) would otherwise make the API return
      // the masked placeholder and trip the apiKey assertion.
      await prisma.instanceSetting.deleteMany({ where: { key: HOLIDAY_EGRESS_SETTING_KEY } });
      await page.goto("/en-US/admin/settings/working-days");
      await expect(page.getByRole("heading", { name: "Working days & holidays" })).toBeVisible();

      // Regression: switching to Calendarific used to leave the Nager host in
      // place, so downloads hit the wrong provider and 404'd.
      await page.getByTestId("wd-egress-provider").selectOption("calendarific");
      await page.getByTestId("wd-egress-enabled").check();
      await page.getByTestId("wd-egress-save").click();
      await expect(page.getByTestId("wd-import-msg")).toContainText("saved");

      const res = await page.request.get("/api/v1/admin/settings/working-days/egress");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        data?: { provider?: string; baseUrl?: string; apiKey?: string };
      };
      expect(body.data?.provider).toBe("calendarific");
      expect(body.data?.baseUrl).toBe("https://calendarific.com");
      // The API key is never returned; without one entered it is empty.
      expect(body.data?.apiKey).toBe("");
    } finally {
      await prisma.instanceSetting.deleteMany({ where: { key: HOLIDAY_EGRESS_SETTING_KEY } });
    }
  });

  test("a non-admin is redirected away from the page", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ".auth/member.json" });
    const page = await ctx.newPage();
    await page.goto("/en-US/admin/settings/working-days");
    // Members lack org:settings; the page guard redirects to the home route.
    await page.waitForURL((url) => !url.pathname.includes("/admin/settings/working-days"), {
      timeout: 10000,
    });
    await ctx.close();
  });
});

test("an undecryptable stored API key is surfaced, not masked as configured", async ({ page }) => {
    // Regression: WEBHOOK_SECRET_ENCRYPTION_KEY differs between .env and
    // .env.prod. A Calendarific key saved under one env was reported as
    // configured (masked) after a restart under the other, while downloads
    // failed with a misleading "API key is required". The UI must warn and
    // the download must explain that the stored key cannot be decrypted.
    const oldKey = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
    try {
      // Encrypt a key with a DIFFERENT key than the server holds, then store
      // it directly — the exact state a cross-env restart leaves behind.
      process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "definitely-not-the-server-key-123";
      const { encryptApiKey } = await import("@/lib/date/holidays/download");
      const foreignBlob = encryptApiKey("cross-env-key-999");

      // value is a Json column; the app stores the object directly (see
      // setInstanceSetting) — stringifying would double-encode and the strict
      // schema would reject it, falling back to defaults.
      const egressValue = { enabled: true, provider: "calendarific", baseUrl: "https://calendarific.com", countryCode: "IR", apiKey: foreignBlob };
      await prisma.instanceSetting.upsert({
        where: { key: HOLIDAY_EGRESS_SETTING_KEY },
        update: { value: egressValue },
        create: { key: HOLIDAY_EGRESS_SETTING_KEY, value: egressValue },
      });

      await page.goto("/en-US/admin/settings/working-days");
      await expect(page.getByTestId("wd-egress-key-broken")).toBeVisible();

      const res = await page.request.get("/api/v1/admin/settings/working-days/egress");
      const body = (await res.json()) as { data?: { apiKey?: string; keyState?: string } };
      expect(body.data?.apiKey).toBe("");
      expect(body.data?.keyState).toBe("broken");

      const csrf = (await page.context().cookies()).find((c) => c.name === "csrf_token")?.value ?? "";
      const dl = await page.request.post("/api/v1/admin/settings/working-days/download", {
        data: { year: 2026 },
        headers: { "x-csrf-token": csrf, "content-type": "application/json" },
      });
      expect(dl.status()).toBe(409);
      const dlBody = (await dl.json()) as { error?: { code?: string } };
      expect(dlBody.error?.code).toBe("api_key_undecryptable");
    } finally {
      if (oldKey === undefined) delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
      else process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = oldKey;
      await prisma.instanceSetting.deleteMany({ where: { key: HOLIDAY_EGRESS_SETTING_KEY } });
    }
  });
