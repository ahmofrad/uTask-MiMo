import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { WORKING_DAYS_SETTING_KEY } from "@/lib/date/working-day";

// NOTE: with `fullyParallel: true`, tests in this file can run in different
// workers, and a file-level afterAll would fire as soon as the fast test
// finishes — deleting the config while the slow test is still mid-flight.
// Cleanup therefore lives inside the test body (try/finally), never in an
// afterAll hook.

test.describe("Working days admin page", () => {
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
      const body = (await res.json()) as { data?: { weekendDays: number[]; holidays: { date: string; name: string }[] } };
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

  test("a non-admin is redirected away from the page", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ".auth/member.json" });
    const page = await ctx.newPage();
    await page.goto("/en-US/admin/settings/working-days");
    // Members lack org:settings; the page guard redirects to the home route.
    await page.waitForURL((url) => !url.pathname.includes("/admin/settings/working-days"), { timeout: 10000 });
    await ctx.close();
  });
});
